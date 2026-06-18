import {
    db, collection, addDoc, getDocs, updateDoc, deleteDoc, doc
} from "./firebase.js";

// ---------------- TIME SYNCHRONIZATION (VIA GITHUB) ----------------
let timeOffset = 0;

async function syncRealTime() {
    try {
        // Ping GitHub's API purely to read their server's Date header
        const response = await fetch('https://api.github.com/', { method: 'HEAD' });
        const githubDateStr = response.headers.get('Date');
        
        if (!githubDateStr) throw new Error("Could not read Date header from GitHub");
        
        // Convert GitHub's GMT string into milliseconds
        const realTimeMs = new Date(githubDateStr).getTime();
        const localTimeMs = Date.now();
        
        timeOffset = realTimeMs - localTimeMs;
        console.log("Clock synced securely via GitHub. Offset:", timeOffset, "ms");
    } catch (error) {
        console.error("GitHub time sync failed. Falling back to shifted PC clock.", error);
    }
}

// 1. Get the TRUE absolute global time (accounts for employee tampering with local PC clock)
function getTrueAbsoluteDate() {
    return new Date(Date.now() + timeOffset);
}

// 2. THE BULLETPROOF EXTRACTOR: Never rely on .getDate() or .getFullYear() directly
function getISTComponents() {
    const now = getTrueAbsoluteDate(); 
    
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata', 
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false
    });
    
    const parts = formatter.formatToParts(now);
    let y, m, d;
    parts.forEach(p => {
        if (p.type === 'year') y = parseInt(p.value, 10);
        if (p.type === 'month') m = parseInt(p.value, 10) - 1; // JS Months are 0-indexed
        if (p.type === 'day') d = parseInt(p.value, 10);
    });
    
    return { year: y, month: m, day: d };
}

// ---------------- DATE FORMATTING ----------------
function getLocalDate() {
    const ist = getISTComponents();
    const year = ist.year;
    const month = String(ist.month + 1).padStart(2, '0');
    const day = String(ist.day).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// --- WORKING DAY LOGIC (Odd Saturdays = Working) ---
function isWorkingDay(date) {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday
    if (dayOfWeek === 0) return false;
    if (dayOfWeek === 6) {
        const dateNum = date.getDate();
        const nthSaturday = Math.ceil(dateNum / 7);
        return nthSaturday % 2 !== 0;
    }
    return true; 
}

// ---------------- LIVE CLOCK ----------------
function updateClockAndDate() {
    const clock = document.getElementById("clock");
    const dateText = document.getElementById("date");
    if(!clock || !dateText) return;

    const now = getTrueAbsoluteDate(); 
    
    // Explicitly binding to Asia/Kolkata ensures it shows Chennai time on index.html immediately
    clock.innerText = now.toLocaleTimeString("en-US", { 
        timeZone: "Asia/Kolkata",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true 
    });
    dateText.innerText = now.toLocaleDateString("en-US", { 
        timeZone: "Asia/Kolkata",
        weekday: "long", year: "numeric", month: "long", day: "numeric" 
    });
}
// Start immediately for index.html, then loop
updateClockAndDate();
setInterval(updateClockAndDate, 1000);

// ---------------- CALENDAR ----------------
function generateCalendar(){
    const monthYear = document.getElementById("monthYear");
    const calendarDates = document.getElementById("calendarDates");
    if(!monthYear || !calendarDates) return;

    // Use strict IST components to prevent PC timezone shifts
    const ist = getISTComponents();
    const year = ist.year;
    const month = ist.month;
    const currentDay = ist.day;

    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    
    monthYear.innerText = `${monthNames[month]} ${year}`;
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    calendarDates.innerHTML = "";
    for(let i = 0; i < firstDay; i++){ calendarDates.appendChild(document.createElement("div")); }
    for(let day = 1; day <= totalDays; day++){
        const dayBox = document.createElement("div");
        dayBox.innerText = day;
        if(day === currentDay) dayBox.classList.add("active-date");
        calendarDates.appendChild(dayBox);
    }
}

// ---------------- HOLIDAYS ----------------
function loadHolidays(){
    const holidayList = document.getElementById("holidayList");
    if(!holidayList) return;
    const holidays = ["Project Review", "Employee Performance", "Weekly Status Update"];
    holidayList.innerHTML = "";
    holidays.forEach(h => {
        const li = document.createElement("li");
        li.innerText = h;
        holidayList.appendChild(li);
    });
}

// ---------------- USERS ----------------
const users = [
    { email: "admin", password: "NR000", name: "Admin User", role: "admin" },
    { email: "kaushal", password: "NR001", name: "Dr Kaushal Kumar Jha", role: "admin" },
    { email: "rima", password: "NR002", name: "Rima Kumari Jha", role: "admin" },
    { email: "HP", password: "NR006", name: "Hari Prasath S", role: "employee" },
    { email: "lathieswar", password: "NR008", name: "CB Lathieswar Reddy", role: "employee" },
    { email: "athivel", password: "NR009", name: "Athivel A", role: "employee" },
    { email: "shareef", password: "NR007", name: "Ahamad shareef Sheik", role: "employee" },
    { email: "haris", password: "NR010", name: "Haris E", role: "employee" },
    { email: "pratik", password: "NR011", name: "Pratik Balbudhe ", role: "employee" },
    { email: "karthik", password: "NRIN02", name: "Murali karthik Kuchan", role: "intern" },
    { email: "javid", password: "NRIN03", name: "Mohammed Javid Jafir N", role: "intern" },
    { email: "rushil", password: "NRIN04", name: "Rushil Kumar M", role: "intern" },
    { email: "aravindhanathan", password: "NRIN05", name: "Aravindhanathan Gurumoorthy", role: "intern" },
    { email: "sreenandini", password: "NRIN06", name: "Sreenandini M", role: "intern" },
    { email: "guganeshwaran", password: "NRIN07", name: "Guganeshwaran S", role: "intern" },
    { email: "sruthi", password: "NRIN08", name: "Sruthi Raj R", role: "intern" },
    { email: "sriharish", password: "NRIN09", name: "Sriharish S R", role: "intern" },
    { email: "siva", password: "NRIN010", name: "Siva S", role: "intern" },
    { email: "premkumar", password: "NRIN011", name: "Premkumar G", role: "intern" },
    { email: "kunal", password: "NRIN012", name: "Kunal Ramteke", role: "intern" },
    { email: "vigneshwaran", password: "NRIN013", name: "Vigneshwaran K", role: "intern" },
    { email: "sakthi", password: "NRIN014", name: "Sakthi Prasanna S", role: "intern" },
    { email: "sania", password: "NRIN015", name: "Sania P", role: "intern" },
    { email: "harish", password: "NRIN016", name: "Harish K", role: "intern" },
    { email: "daniel", password: "NRIN017", name: "Daniel Joshua ES", role: "intern" },
    { email: "hansini", password: "NRIN018", name: "Hansini S", role: "intern" }
];

function populateEmployeeDropdown() {
    const select = document.getElementById("employeeSelect");
    if (!select) return;
    select.innerHTML = "";
    users.forEach(user => {
        if (user.role === "employee" || user.role === "intern") {
            const option = document.createElement("option");
            option.value = user.name;
            option.innerText = user.name;
            select.appendChild(option);
        }
    });
}

function renderAdminEmployees() {
    const table = document.getElementById("adminEmployeesTable");
    if (!table) return;
    table.innerHTML = "";
    users.forEach(user => {
        if(user.role === "employee" || user.role === "intern"){
            table.innerHTML += `
                <tr>
                    <td>
                        <a href="#" style="color:#3b82f6; text-decoration:underline; cursor:pointer;" 
                           onclick="TaskTracker.viewEmployeeDetails('${user.name}')">${user.name}</a>
                    </td>
                    <td>${user.email}</td>
                    <td><span style="text-transform: capitalize;">${user.role}</span></td>
                </tr>
            `;
        }
    });
}

const currentPage = window.location.pathname.split("/").pop();

const TaskTracker = {
    switchAdminView(view) {
        sessionStorage.setItem("currentAdminView", view); 
        const views = {
            'tasks': document.getElementById("adminTasksView"),
            'employees': document.getElementById("adminEmployeesView"),
            'projects': document.getElementById("adminProjectsView"),
            'calendar': document.getElementById("adminCalendarView"),
            'employeeDetails': document.getElementById("adminEmployeeDetailsView"),
            'attendance': document.getElementById("adminAttendanceView"),
            'leaves': document.getElementById("adminLeavesView")
        };
        const links = document.querySelectorAll(".sidebar a");

        Object.values(views).forEach(v => { if(v) v.style.display = "none"; });
        links.forEach(l => l.classList.remove("active"));

        if (view === "tasks" && views.tasks) {
            views.tasks.style.display = "block";
            if(links[0]) links[0].classList.add("active");
            populateEmployeeDropdown(); 
            this.renderAdminProjects(); 
            this.renderAdminTasks();    
        } else if (view === "employees" && views.employees) {
            views.employees.style.display = "block";
            if(links[1]) links[1].classList.add("active");
            renderAdminEmployees();
        } else if (view === "projects" && views.projects) {
            views.projects.style.display = "block";
            if(links[2]) links[2].classList.add("active");
            this.renderAdminProjects();
        } else if (view === "calendar" && views.calendar) {
            views.calendar.style.display = "block";
            if(links[3]) links[3].classList.add("active");
            this.renderFullCalendar();
        } else if (view === "employeeDetails" && views.employeeDetails) {
            views.employeeDetails.style.display = "block";
            if(links[1]) links[1].classList.add("active"); 
        } else if (view === "attendance" && views.attendance) { 
            views.attendance.style.display = "block";
            if(links[4]) links[4].classList.add("active"); 
            this.renderAdminAttendance();
        } else if (view === "leaves" && views.leaves) { 
            views.leaves.style.display = "block";
            if(links[5]) links[5].classList.add("active"); 
            this.renderAdminLeaves();
        }
    },

    login(){
        const email = document.getElementById("email")?.value.trim();
        const password = document.getElementById("password")?.value.trim();
        const user = users.find(u => u.email === email && u.password === password);

        if(!user){ alert("Invalid Email or Password"); return; }
        sessionStorage.setItem("loggedInUser", JSON.stringify(user));
        window.location.href = user.role === "admin" ? "admin.html" : "employee.html";
    },

    checkAuth(){
        if(currentPage === "index.html" || currentPage === "") return;
        const user = JSON.parse(sessionStorage.getItem("loggedInUser"));
        if(!user && currentPage !== "login.html"){
            window.location.href = "login.html"; return;
        }
        const username = document.getElementById("username");
        if(username && user) username.innerText = `${user.name} (${user.role})`;
    },

    logout(){
        sessionStorage.removeItem("loggedInUser"); 
        sessionStorage.removeItem("currentAdminView"); 
        sessionStorage.removeItem("currentEmployeeView"); 
        window.location.href = "index.html";
    },

    async saveProject() {
        try {
            const name = document.getElementById("projectName").value.trim();
            const description = document.getElementById("projectDescription").value.trim();
            const editId = document.getElementById("editProjectId").value;

            if(!name) { alert("Project name is required!"); return; }

            if(editId) {
                await updateDoc(doc(db, "projects", editId), { name, description });
                alert("Project Updated");
                this.cancelProjectEdit();
            } else {
                await addDoc(collection(db, "projects"), { name, description, createdAt: new Date().toISOString() });
                alert("Project Created");
                this.cancelProjectEdit();
            }
            this.renderAdminProjects();
        } catch(e) { console.error(e); alert("Failed to save project."); }
    },

    editProject(id, name, desc) {
        document.getElementById("projectFormTitle").innerText = "Edit Project";
        document.getElementById("editProjectId").value = id;
        document.getElementById("projectName").value = name;
        document.getElementById("projectDescription").value = desc;
        document.getElementById("submitProjectBtn").innerText = "Update Project";
        document.getElementById("cancelProjectEditBtn").style.display = "block";
    },

    cancelProjectEdit() {
        document.getElementById("projectFormTitle").innerText = "Create Project";
        document.getElementById("editProjectId").value = "";
        document.getElementById("projectName").value = "";
        document.getElementById("projectDescription").value = "";
        document.getElementById("submitProjectBtn").innerText = "Save Project";
        document.getElementById("cancelProjectEditBtn").style.display = "none";
    },

    async deleteProject(id) {
        if(!confirm("Delete this project? Tasks assigned to it will retain the text name but lose the database link.")) return;
        try {
            await deleteDoc(doc(db, "projects", id));
            this.renderAdminProjects();
        } catch(e) { console.error(e); }
    },

    async renderAdminProjects() {
        const table = document.getElementById("adminProjectTable");
        const select = document.getElementById("projectSelect");
        if(!table && !select) return;

        if(table) table.innerHTML = "";
        if(select) select.innerHTML = '<option value="None">None</option>';

        try {
            const snap = await getDocs(collection(db, "projects"));
            snap.forEach(docSnap => {
                const proj = docSnap.data();
                const id = docSnap.id;
                
                if(table) {
                    const escName = (proj.name || "").replace(/'/g, "\\'");
                    const escDesc = (proj.description || "").replace(/'/g, "\\'");
                    table.innerHTML += `
                        <tr>
                            <td><strong>${proj.name}</strong></td>
                            <td>${proj.description}</td>
                            <td>
                                <button class="action-btn edit-btn" onclick="TaskTracker.editProject('${id}', '${escName}', '${escDesc}')">Edit</button>
                                <button class="action-btn delete-btn" onclick="TaskTracker.deleteProject('${id}')">Delete</button>
                            </td>
                        </tr>
                    `;
                }

                if(select) {
                    const opt = document.createElement("option");
                    opt.value = proj.name;
                    opt.innerText = proj.name;
                    select.appendChild(opt);
                }
            });
        } catch(e) { 
            console.error(e); 
            alert("Failed to save project."); 
        }
    },

    async assignTask(){
        try {
            const title = document.getElementById("taskTitle").value.trim();
            const description = document.getElementById("taskDescription").value.trim();
            const employee = document.getElementById("employeeSelect").value;
            const project = document.getElementById("projectSelect").value;
            const startDate = document.getElementById("startDate").value;
            const endDate = document.getElementById("endDate").value;
            const editTaskId = document.getElementById("editTaskId")?.value;

            if(!title || !startDate || !endDate){ alert("Title and Dates are required!"); return; }

            const taskData = { title, description, employee, project, startDate, endDate };

            if (editTaskId) {
                await updateDoc(doc(db, "tasks", editTaskId), taskData);
                alert("Task Updated");
                this.cancelEdit();
            } else {
                taskData.status = "Not Started Yet";
                taskData.remarks = "";
                taskData.createdAt = new Date().toISOString();
                await addDoc(collection(db,"tasks"), taskData);
                alert("Task Assigned");
                this.clearForm();
            }
            this.renderAdminTasks();
        } catch(error){ 
            console.error(error); 
            alert("Firebase operation failed"); 
        }
    },

    editTask(id, title, description, employee, project, startDate, endDate) {
        this.switchAdminView('tasks');
        document.getElementById("formTitle").innerText = "Edit Task";
        document.getElementById("editTaskId").value = id;
        document.getElementById("taskTitle").value = title;
        document.getElementById("taskDescription").value = description;
        document.getElementById("employeeSelect").value = employee;
        document.getElementById("projectSelect").value = project || "None";
        document.getElementById("startDate").value = startDate || "";
        document.getElementById("endDate").value = endDate || "";
        
        document.getElementById("submitTaskBtn").innerText = "Save Changes";
        document.getElementById("cancelEditBtn").style.display = "block";
        document.querySelector(".task-form").scrollIntoView({ behavior: 'smooth' });
    },

    cancelEdit() {
        document.getElementById("formTitle").innerText = "Create & Assign Task";
        document.getElementById("submitTaskBtn").innerText = "Assign Task";
        document.getElementById("cancelEditBtn").style.display = "none";
        this.clearForm();
    },

    clearForm() {
        document.getElementById("editTaskId").value = "";
        document.getElementById("taskTitle").value = "";
        document.getElementById("taskDescription").value = "";
        document.getElementById("projectSelect").value = "None";
        document.getElementById("startDate").value = "";
        document.getElementById("endDate").value = "";
    },

    async deleteTask(id) {
        if(!confirm("Are you sure you want to delete this task?")) return;
        try {
            await deleteDoc(doc(db, "tasks", id));
            this.renderAdminTasks();
        } catch(error) { console.error(error); }
    },

    async renderAdminTasks(){
        const table = document.getElementById("adminTaskTable");
        if(!table) return;
        table.innerHTML = "<tr><td colspan='7' style='text-align:center; padding: 20px; color: white;'>Loading tasks...</td></tr>";

        try {
            const snapshot = await getDocs(collection(db,"tasks"));
            let taskList = [];
            snapshot.forEach(docSnap => {
                taskList.push({ id: docSnap.id, ...docSnap.data() });
            });

            // 1. Group Tasks by Project
            const tasksByProject = {};
            taskList.forEach(task => {
                const projName = task.project && task.project !== "None" ? task.project : "General / Unassigned Tasks";
                if (!tasksByProject[projName]) {
                    tasksByProject[projName] = [];
                }
                tasksByProject[projName].push(task);
            });

            table.innerHTML = ""; 

            // If database is empty
            if (Object.keys(tasksByProject).length === 0) {
                table.innerHTML = "<tr><td colspan='7' style='text-align:center; padding: 20px; color: #e2e8f0;'>No tasks assigned yet.</td></tr>";
                return;
            }

            // 2. Render each project group separately
            for (const [project, tasks] of Object.entries(tasksByProject)) {
                
                // Sort tasks internally: "Not Started Yet" -> "Work In Progress" -> "Work Done"
                tasks.sort((a, b) => {
                    const statusWeight = { "Not Started Yet": 1, "Work In Progress": 2, "Work Done": 3 };
                    return (statusWeight[a.status] || 99) - (statusWeight[b.status] || 99);
                });

                // Add a bold, stylized separator row for the Project header (Darkened background for white text)
                table.innerHTML += `
                    <tr style="background-color: #334155; border-top: 3px solid #475569; border-bottom: 2px solid #1e293b;">
                        <td colspan="7" style="padding: 12px 15px; font-size: 16px; font-weight: bold; color: #ffffff; text-align: left;">
                            📁 ${project} 
                            <span style="font-size: 12px; font-weight: normal; color: #ffffff; margin-left: 10px; background: #475569; padding: 4px 10px; border-radius: 12px;">
                                ${tasks.length} Task${tasks.length > 1 ? 's' : ''}
                            </span>
                        </td>
                    </tr>
                `;

                // Add the individual task rows under this project header
                tasks.forEach((task)=>{
                    const taskId = task.id;
                    const escTitle = (task.title || "").replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/(\r\n|\n|\r)/gm, " ");
                    const escDesc = (task.description || "").replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/(\r\n|\n|\r)/gm, " ");
                    const escEmp = (task.employee || "").replace(/'/g, "\\'").replace(/"/g, "&quot;");
                    const escProj = (task.project || "None").replace(/'/g, "\\'").replace(/"/g, "&quot;");

                    // Create color-coded status badges for quick scanning
                    let statusBadge = "";
                    if (task.status === "Work Done") {
                        statusBadge = `<span style="background:#10b981; color:white; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold;">${task.status}</span>`;
                    } else if (task.status === "Work In Progress") {
                        statusBadge = `<span style="background:#f59e0b; color:white; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold;">${task.status}</span>`;
                    } else {
                        statusBadge = `<span style="background:#64748b; color:white; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold;">${task.status}</span>`;
                    }

                    // Build standard row with pure white and brightened text colors
                    table.innerHTML += `
                    <tr>
                        <td style="font-weight: 500; color: #ffffff; padding-left: 20px;">${task.title}</td>
                        <td style="color: #e2e8f0; font-size: 13px;">${task.project || '-'}</td>
                        <td style="font-weight: bold; color: #60a5fa;">${task.employee}</td>
                        <td style="font-size: 12px; color: #e2e8f0;">S: ${task.startDate || 'N/A'}<br>E: ${task.endDate || 'N/A'}</td>
                        <td>${statusBadge}</td>
                        <td style="font-size: 13px; color: #e2e8f0; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${task.remarks || ''}">
                            ${task.remarks || '<em style="color:#94a3b8;">None</em>'}
                        </td>
                        <td>
                            <button class="action-btn edit-btn" style="padding: 6px 12px; margin-right: 4px;" onclick="TaskTracker.editTask('${taskId}', '${escTitle}', '${escDesc}', '${escEmp}', '${escProj}', '${task.startDate}', '${task.endDate}')">Edit</button>
                            <button class="action-btn delete-btn" style="padding: 6px 12px;" onclick="TaskTracker.deleteTask('${taskId}')">Delete</button>
                        </td>
                    </tr>`;
                });
            }
        } catch(error){ 
            console.error(error); 
            table.innerHTML = "<tr><td colspan='7' style='text-align:center; color:#ef4444;'>Failed to load tasks. Check console.</td></tr>";
        }
    },

    async renderEmployeeTasks(){
        const table = document.getElementById("employeeTaskTable");
        if(!table) return;
        table.innerHTML = "";

        const currentUser = JSON.parse(sessionStorage.getItem("loggedInUser")); 
        if(!currentUser) return;

        try {
            const snapshot = await getDocs(collection(db,"tasks"));
            let myTasks = [];
            
            snapshot.forEach((taskDoc)=>{
                const task = taskDoc.data();
                task.id = taskDoc.id; 
                if(task.employee === currentUser.name){
                    myTasks.push(task);
                }
            });

            myTasks.sort((a, b) => {
                const dateA = new Date(a.startDate || "9999-12-31"); 
                const dateB = new Date(b.startDate || "9999-12-31");
                return dateB - dateA; 
            });

            myTasks.forEach((task)=>{
                table.innerHTML += `
                <tr>
                    <td><strong>${task.project || 'None'}</strong></td>
                    <td>${task.title}</td>
                    <td>${task.description}</td>
                    <td>${task.startDate || 'N/A'}</td>
                    <td>${task.endDate || 'N/A'}</td>
                    <td>
                        <select class="status-select" id="status-${task.id}">
                            <option ${task.status === "Not Started Yet" ? "selected" : ""}>Not Started Yet</option>
                            <option ${task.status === "Work In Progress" ? "selected" : ""}>Work In Progress</option>
                            <option ${task.status === "Work Done" ? "selected" : ""}>Work Done</option>
                        </select>
                    </td>
                    <td>
                        <textarea 
                            class="remark-box" 
                            id="remark-${task.id}" 
                            oninput="this.style.height = ''; this.style.height = this.scrollHeight + 'px'">${task.remarks || ""}
                        </textarea>
                    </td>
                   <td><button id="saveBtn-${task.id}" class="save-btn" onclick="TaskTracker.updateTask('${task.id}')">Save</button></td>
                </tr>`;
            });
            
            if(myTasks.length === 0) {
                table.innerHTML = "<tr><td colspan='8' style='text-align:center;'>No tasks assigned.</td></tr>";
            }
        } catch(error){ console.error(error); }
    },

    async updateTask(id){
        const btn = document.getElementById(`saveBtn-${id}`);
        if (btn) {
            btn.disabled = true;
            btn.innerText = "Saving...";
            btn.style.opacity = "0.6";
        }

        try{
            const status = document.getElementById(`status-${id}`).value;
            const remarks = document.getElementById(`remark-${id}`).value;
            await updateDoc(doc(db,"tasks",id),{ status, remarks });
            alert("Task Updated Successfully");
            this.renderEmployeeTasks();
        } catch(error){ 
            console.error(error); 
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerText = "Save";
                btn.style.opacity = "1";
            }
        }
    },

    async viewEmployeeDetails(employeeName) {
        sessionStorage.setItem("currentEmployeeDetailName", employeeName); 
        this.switchAdminView('employeeDetails');
        document.getElementById("reportEmployeeName").innerText = employeeName;
        
        const typeSelect = document.getElementById("reportTypeSelect");
        if(typeSelect) typeSelect.value = "tasks";
        this.toggleEmployeeReportView(); 
        
        const taskTable = document.getElementById("reportTaskTable");
        const attendanceTable = document.getElementById("reportAttendanceTable");
        if (taskTable) taskTable.innerHTML = "";
        if (attendanceTable) attendanceTable.innerHTML = "";

        try {
            const leaveSnap = await getDocs(collection(db, "leaves"));
            let totalLeaveDays = 0;
            leaveSnap.forEach(docSnap => {
                const l = docSnap.data();
                if(l.employee === employeeName && l.status === 'Approved') {
                    let currentDate = new Date(l.fromDate + 'T00:00:00');
                    const endDate = new Date(l.toDate + 'T00:00:00');
                    while(currentDate <= endDate) {
                        if (isWorkingDay(currentDate)) {
                            totalLeaveDays += (l.dayType === 'Full') ? 1 : 0.5;
                        }
                        currentDate.setDate(currentDate.getDate() + 1);
                    }
                }
            });

            const reportDateElem = document.getElementById("reportDate");
            if (reportDateElem) {
                reportDateElem.innerText = `${new Date().toLocaleDateString()} | Total Leaves Taken: ${totalLeaveDays} Days`;
            }

            const taskSnap = await getDocs(collection(db, "tasks"));
            let employeeTasks = [];
            
            taskSnap.forEach(docSnap => {
                const task = docSnap.data();
                if(task.employee === employeeName) {
                    employeeTasks.push(task);
                }
            });

            employeeTasks.sort((a, b) => {
                const dateA = new Date(a.startDate || 0);
                const dateB = new Date(b.startDate || 0);
                return dateB - dateA; 
            });

            employeeTasks.forEach(task => {
                if(taskTable) {
                    taskTable.innerHTML += `
                        <tr>
                            <td style="color: black; border-bottom: 1px solid #e2e8f0;">${task.project || 'None'}</td>
                            <td style="color: black; border-bottom: 1px solid #e2e8f0;">${task.title}</td>
                            <td style="color: black; border-bottom: 1px solid #e2e8f0;">${task.startDate || '-'}</td>
                            <td style="color: black; border-bottom: 1px solid #e2e8f0;">${task.endDate || '-'}</td>
                            <td style="color: black; border-bottom: 1px solid #e2e8f0;"><strong>${task.status}</strong></td>
                            <td style="color: black; border-bottom: 1px solid #e2e8f0;">${task.remarks || '-'}</td>
                        </tr>
                    `;
                }
            });
            
            if(employeeTasks.length === 0 && taskTable) {
                taskTable.innerHTML = "<tr><td colspan='6' style='text-align:center; color: black;'>No tasks assigned.</td></tr>";
            }

            const attSnap = await getDocs(collection(db, "attendance"));
            let attRecords = [];
            attSnap.forEach(docSnap => {
                const att = docSnap.data();
                if(att.employee === employeeName && isWorkingDay(new Date(att.date + 'T00:00:00'))) {
                    attRecords.push(att);
                }
            });
            
            attRecords.sort((a,b) => new Date(b.date) - new Date(a.date));

            attRecords.forEach(att => {
                const statusColor = att.status === 'Present' ? 'color: #10b981;' : 'color: #ef4444;';
                if(attendanceTable) {
                    attendanceTable.innerHTML += `
                        <tr>
                            <td style="color: black; border-bottom: 1px solid #e2e8f0;">${att.date}</td>
                            <td style="border-bottom: 1px solid #e2e8f0; ${statusColor}"><strong>${att.status}</strong></td>
                            <td style="color: black; border-bottom: 1px solid #e2e8f0;">${att.checkIn || '-'}</td>
                            <td style="color: black; border-bottom: 1px solid #e2e8f0;">${att.checkOut || '-'}</td>
                            <td style="color: black; border-bottom: 1px solid #e2e8f0;"><strong>${att.totalTime || '-'}</strong></td>
                        </tr>
                    `;
                }
            });
            if(attRecords.length === 0 && attendanceTable) attendanceTable.innerHTML = "<tr><td colspan='5' style='text-align:center; color: black;'>No attendance records found.</td></tr>";

        } catch(e) { console.error(e); }
    },

    downloadPDF() {
        const element = document.getElementById('pdfReportArea');
        const empNameElem = document.getElementById("reportEmployeeName");
        if(!element || !empNameElem) return;
        
        const empName = empNameElem.innerText;
        const opt = {
            margin:       0.5,
            filename:     `${empName.replace(/\s+/g, '_')}_Task_Report.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
        };

        html2pdf().set(opt).from(element).save();
    },

    async handleAttendance(action) {
        const user = JSON.parse(sessionStorage.getItem("loggedInUser")); 
        if (!user) return;

        const trueNow = getTrueAbsoluteDate(); 
        const today = getLocalDate();
        
        // Explicit strict timezone enforcement during formatting
        const nowTime = trueNow.toLocaleTimeString("en-US", { 
            timeZone: "Asia/Kolkata",
            hour: "2-digit", minute: "2-digit", hour12: true 
        });
        const nowMs = trueNow.getTime(); 
        
        try {
            const snapshot = await getDocs(collection(db, "attendance"));
            let existingDocId = null;
            let existingData = null;

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (data.employee === user.name && data.date === today) {
                    existingDocId = docSnap.id;
                    existingData = data;
                }
            });

            const msgElement = document.getElementById("attendanceStatusMsg");

            if (action === 'CheckIn') {
                if (existingDocId) {
                    alert("You have already checked in or marked leave for today."); return;
                }
                await addDoc(collection(db, "attendance"), {
                    employee: user.name, date: today, status: 'Present',
                    checkIn: nowTime, checkInMs: nowMs, checkOut: '-', checkOutMs: null, totalTime: '-'
                });
                if (msgElement) {
                    msgElement.innerText = `Status: Checked In at ${nowTime}`;
                    msgElement.style.color = '#10b981';
                }
                alert("Checked in successfully!");
            } 
            else if (action === 'CheckOut') {
                if (!existingDocId) {
                    alert("You need to Check In first!"); return;
                }
                if (existingData.status === 'Leave') {
                    alert("You are marked on leave today."); return;
                }
                if (existingData.checkOutMs) {
                    alert("You have already checked out for today."); return;
                }
                
                const durationMs = nowMs - existingData.checkInMs;
                const hours = Math.floor(durationMs / (1000 * 60 * 60));
                const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                const totalTimeString = `${hours}h ${minutes}m`;

                await updateDoc(doc(db, "attendance", existingDocId), {
                    checkOut: nowTime, checkOutMs: nowMs, totalTime: totalTimeString
                });

                if (msgElement) {
                    msgElement.innerText = `Status: Checked Out at ${nowTime}. Total: ${totalTimeString}`;
                    msgElement.style.color = '#eab308';
                }
                alert(`Checked out successfully! Total worked: ${totalTimeString}`);
            } 
        } catch (error) {
            console.error(error); alert("Operation failed. Check connection.");
        }
    },

    async renderAdminAttendance() {
        const table = document.getElementById("adminAttendanceTable");
        const filterDateInput = document.getElementById("attendanceFilterDate");
        if (!table || !filterDateInput) return;

        table.innerHTML = "";
        if (!filterDateInput.value) filterDateInput.value = getLocalDate();
        const filterDate = filterDateInput.value;

        const selectedDateObj = new Date(filterDate + 'T00:00:00');
        if (!isWorkingDay(selectedDateObj)) {
            table.innerHTML = `<tr><td colspan='6' style='text-align:center; color:#ef4444;'>${filterDate} is a Non-Working Day (Sunday or Even Saturday). No attendance required.</td></tr>`;
            return;
        }

        try {
            const snapshot = await getDocs(collection(db, "attendance"));
            let hasRecords = false;

            snapshot.forEach(docSnap => {
                const record = docSnap.data();
                if (record.date === filterDate) {
                    hasRecords = true;
                    const statusColor = record.status === 'Present' ? '#10b981' : '#ef4444';
                    table.innerHTML += `
                        <tr>
                            <td><strong>${record.employee}</strong></td>
                            <td>${record.date}</td>
                            <td><span style="background: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${record.status}</span></td>
                            <td>${record.checkIn || '-'}</td>
                            <td>${record.checkOut || '-'}</td>
                            <td><strong>${record.totalTime || '-'}</strong></td>
                        </tr>
                    `;
                }
            });
            if (!hasRecords) table.innerHTML = `<tr><td colspan='6' style='text-align:center; color:#94a3b8;'>No attendance logged for ${filterDate}.</td></tr>`;
        } catch (error) { console.error(error); }
    },

    toggleEmployeeReportView() {
        const reportTypeElem = document.getElementById("reportTypeSelect");
        if(!reportTypeElem) return;
        const reportType = reportTypeElem.value;
        const titleType = document.getElementById("reportTitleType");
        const taskWrapper = document.getElementById("reportTaskTableWrapper");
        const attWrapper = document.getElementById("reportAttendanceTableWrapper");

        if (reportType === 'tasks') {
            if(titleType) titleType.innerText = "Task";
            if(taskWrapper) taskWrapper.style.display = "table";
            if(attWrapper) attWrapper.style.display = "none";
        } else {
            if(titleType) titleType.innerText = "Attendance";
            if(taskWrapper) taskWrapper.style.display = "none";
            if(attWrapper) attWrapper.style.display = "table";
        }
    },

    async renderFullCalendar() {
        const calendarGrid = document.getElementById("mainCalendarGrid");
        if (!calendarGrid) return;
        calendarGrid.innerHTML = "";
        
        // Strictly get the real Chennai date, ignoring the computer
        const ist = getISTComponents();
        const year = ist.year;
        const month = ist.month;
        const today = ist.day;
        
        const totalDays = new Date(year, month + 1, 0).getDate();

        for (let day = 1; day <= totalDays; day++) {
            const dayDiv = document.createElement("div");
            dayDiv.innerText = day;
            dayDiv.className = "calendar-day";
            
            if (day === today) {
                dayDiv.style.background = "#2563eb";
                dayDiv.style.color = "white";
                dayDiv.style.fontWeight = "bold";
                dayDiv.style.borderRadius = "4px";
            }
            
            dayDiv.onclick = () => this.showTasksForDate(day);
            calendarGrid.appendChild(dayDiv);
        }
        
        this.showTasksForDate(today);
    },

    async showTasksForDate(day) {
        const table = document.getElementById("calendarTaskTable");
        const titleElement = document.getElementById("selectedDateTasksTitle");
        if(!table || !titleElement) return;
        
        const ist = getISTComponents();
        const year = ist.year;
        const month = String(ist.month + 1).padStart(2, '0');
        const formattedDate = `${year}-${month}-${String(day).padStart(2, '0')}`;
        
        titleElement.innerText = `Tasks for ${formattedDate}`;
        table.innerHTML = "<tr><td colspan='3' style='text-align:center;'>Loading tasks...</td></tr>";

        try {
            const snapshot = await getDocs(collection(db, "tasks"));
            table.innerHTML = ""; 
            let hasTasks = false;

            snapshot.forEach(doc => {
                const task = doc.data();
                if (task.startDate === formattedDate) {
                    hasTasks = true;
                    table.innerHTML += `
                    <tr>
                        <td>${task.title}</td>
                        <td>${task.employee}</td>
                        <td><span style="background:#1e293b; padding:4px 8px; border-radius:4px; font-size:12px;">${task.status}</span></td>
                    </tr>`;
                }
            });

            if (!hasTasks) {
                table.innerHTML = `<tr><td colspan='3' style='text-align:center; color:#94a3b8;'>No tasks assigned for this date.</td></tr>`;
            }

        } catch (error) {
            console.error("Firebase Error: ", error);
            table.innerHTML = "<tr><td colspan='3' style='text-align:center; color:#ef4444;'>Error loading tasks. Check console.</td></tr>";
        }
     },

    switchEmployeeView(view) {
        sessionStorage.setItem("currentEmployeeView", view);
        const dashboard = document.getElementById("employeeDashboardView");
        const leaveForm = document.getElementById("employeeLeaveFormView");
        const links = document.querySelectorAll(".sidebar a");

        if(dashboard) dashboard.style.display = "none";
        if(leaveForm) leaveForm.style.display = "none";
        links.forEach(l => l.classList.remove("active"));

        if (view === 'leaveForm' && leaveForm) {
            leaveForm.style.display = "block";
            if(links[2]) links[2].classList.add("active"); 
            this.renderEmployeeLeaves(); 
        } else if (dashboard) {
            dashboard.style.display = "block";
            if(links[0]) links[0].classList.add("active");
            this.renderEmployeeTasks();
        }
    },

    toggleLeaveForm() {
        const formContainer = document.getElementById("leaveFormContainer");
        if(!formContainer) return;
        if (formContainer.style.display === "none") {
            formContainer.style.display = "block";
        } else {
            formContainer.style.display = "none";
        }
    },

    async renderEmployeeLeaves() {
        const table = document.getElementById("employeeLeavesTable");
        if (!table) return;
        table.innerHTML = "<tr><td colspan='6' style='text-align:center;'>Loading leaves...</td></tr>";

        const user = JSON.parse(sessionStorage.getItem("loggedInUser"));
        if (!user) return;

        try {
            const snapshot = await getDocs(collection(db, "leaves"));
            let leaves = [];
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (data.employee === user.name) {
                    leaves.push(data);
                }
            });

            leaves.sort((a, b) => new Date(b.fromDate) - new Date(a.fromDate));

            table.innerHTML = "";
            leaves.forEach(data => {
                let statusColor = "white";
                if(data.status === 'Approved') statusColor = "#10b981"; 
                if(data.status === 'Rejected') statusColor = "#ef4444"; 
                if(data.status === 'Pending') statusColor = "#eab308";  

                table.innerHTML += `
                    <tr>
                        <td>${data.leaveType}</td>
                        <td>${data.dayType}</td>
                        <td>${data.fromDate}</td>
                        <td>${data.toDate}</td>
                        <td>${data.reason}</td>
                        <td><strong style="color: ${statusColor};">${data.status}</strong></td>
                    </tr>
                `;
            });
            
            if (leaves.length === 0) {
                table.innerHTML = "<tr><td colspan='6' style='text-align:center; color: #94a3b8;'>No leave requests found.</td></tr>";
            }
        } catch (error) {
            console.error(error);
        }
    },

    async applyLeave() {
        const user = JSON.parse(sessionStorage.getItem("loggedInUser")); 
        if (!user) return;

        const leaveTypeElem = document.querySelector('input[name="leaveType"]:checked');
        const dayTypeElem = document.querySelector('input[name="dayType"]:checked');
        if(!leaveTypeElem || !dayTypeElem) return;
        
        const leaveType = leaveTypeElem.value;
        const dayType = dayTypeElem.value;
        const fromDate = document.getElementById("leaveFromDate").value;
        const toDate = document.getElementById("leaveToDate").value;
        const reason = document.getElementById("leaveReason").value.trim();

        if (!fromDate || !toDate || !reason) {
            alert("Please select dates and provide a reason.");
            return;
        }

        try {
            await addDoc(collection(db, "leaves"), {
                employee: user.name,
                leaveType,
                dayType,
                fromDate,
                toDate,
                reason,
                status: 'Pending',
                appliedAt: new Date().toISOString()
            });
            alert("Leave application submitted!");
            
            document.getElementById("leaveReason").value = "";
            document.getElementById("leaveFromDate").value = "";
            document.getElementById("leaveToDate").value = "";
            
            this.toggleLeaveForm();
            this.renderEmployeeLeaves(); 
            
        } catch (error) {
            console.error(error);
            alert("Failed to submit leave application.");
        }
    },

    async updateLeaveBadge() {
        const badge = document.getElementById("leaveBadge");
        if (!badge) return;
        
        try {
            const snapshot = await getDocs(collection(db, "leaves"));
            let pendingCount = 0;
            snapshot.forEach(docSnap => {
                if(docSnap.data().status === 'Pending') pendingCount++;
            });
            
            if (pendingCount > 0) {
                badge.innerText = pendingCount;
                badge.style.display = "inline-block";
            } else {
                badge.style.display = "none";
            }
        } catch (error) { console.error(error); }
    },

    async renderAdminLeaves() {
        const table = document.getElementById("adminLeavesTable");
        if (!table) return;
        table.innerHTML = "";

        try {
            const snapshot = await getDocs(collection(db, "leaves"));
            let allLeaves = [];
            
            snapshot.forEach(docSnap => {
                allLeaves.push({ id: docSnap.id, ...docSnap.data() });
            });

            allLeaves.sort((a, b) => new Date(b.fromDate) - new Date(a.fromDate));

            allLeaves.forEach(data => {
                const id = data.id;
                const escEmp = (data.employee || "").replace(/'/g, "\\'"); 
                
                table.innerHTML += `
                    <tr>
                        <td><strong>${data.employee}</strong></td>
                        <td>${data.leaveType}</td>
                        <td>${data.dayType}</td>
                        <td>${data.fromDate}</td>
                        <td>${data.toDate}</td>
                        <td>${data.reason}</td>
                        <td><strong>${data.status}</strong></td>
                        <td>
                            ${data.status === 'Pending' ? `
                            <button class="action-btn" style="background:#10b981;" onclick="TaskTracker.approveLeave('${id}', '${escEmp}', '${data.fromDate}', '${data.toDate}', '${data.dayType}')">Approve</button>
                            <button class="action-btn delete-btn" onclick="TaskTracker.rejectLeave('${id}')">Reject</button>
                            ` : '-'}
                        </td>
                    </tr>
                `;
            });
            
            this.updateLeaveBadge(); 
            
        } catch (error) { console.error(error); }
    },

    async approveLeave(leaveId, employeeName, fromDate, toDate, dayType) {
        if(!confirm(`Approve leave for ${employeeName}?`)) return;
        
        try {
            await updateDoc(doc(db, "leaves", leaveId), { status: 'Approved' });
            
            if (dayType === 'Full') {
                let currentDate = new Date(fromDate + 'T00:00:00');
                const endDate = new Date(toDate + 'T00:00:00');
                
                while (currentDate <= endDate) {
                    if (isWorkingDay(currentDate)) {
                        const dateString = currentDate.toISOString().split('T')[0];
                        
                        await addDoc(collection(db, "attendance"), {
                            employee: employeeName,
                            date: dateString,
                            status: 'Leave',
                            checkIn: '-',
                            checkInMs: null,
                            checkOut: '-',
                            checkOutMs: null,
                            totalTime: '-'
                        });
                    }
                    
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            }
            
            alert("Leave Approved!");
            this.renderAdminLeaves();
        } catch (error) { 
            console.error(error); 
            alert("Failed to approve leave."); 
        }
    },

    async rejectLeave(leaveId) {
        if(!confirm("Are you sure you want to reject this leave?")) return;
        try {
            await updateDoc(doc(db, "leaves", leaveId), { status: 'Rejected' });
            this.renderAdminLeaves();
        } catch (error) { console.error(error); }
    }
};

window.TaskTracker = TaskTracker;

window.onload = async () => {
    // 1. Sync time before doing anything else
    await syncRealTime(); 
    
    // 2. Initialize application logic
    updateClockAndDate();
    generateCalendar();
    loadHolidays();
    populateEmployeeDropdown();
    TaskTracker.checkAuth();

    if (currentPage === "admin.html") {
        const savedView = sessionStorage.getItem("currentAdminView") || "tasks";
        
        if (savedView === "employeeDetails") {
            const savedEmpName = sessionStorage.getItem("currentEmployeeDetailName");
            if (savedEmpName) {
                TaskTracker.viewEmployeeDetails(savedEmpName);
            } else {
                TaskTracker.switchAdminView('employees'); 
            }
        } else {
            TaskTracker.switchAdminView(savedView);
        }
        
        TaskTracker.updateLeaveBadge(); 
        
    } else if (currentPage === "employee.html") {
        const savedView = sessionStorage.getItem("currentEmployeeView") || "dashboard";
        TaskTracker.switchEmployeeView(savedView);
    }
};

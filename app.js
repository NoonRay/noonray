import {
    db, collection, addDoc, getDocs, updateDoc, deleteDoc, doc
} from "./firebase.js";

function getLocalDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ---------------- LIVE CLOCK ----------------
function updateClockAndDate() {
    const clock = document.getElementById("clock");
    const dateText = document.getElementById("date");
    if(!clock || !dateText) return;

    const now = new Date();
    clock.innerText = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
    dateText.innerText = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
setInterval(updateClockAndDate, 1000);
updateClockAndDate();

// ---------------- CALENDAR ----------------
function generateCalendar(){
    const monthYear = document.getElementById("monthYear");
    const calendarDates = document.getElementById("calendarDates");
    if(!monthYear || !calendarDates) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    
    monthYear.innerText = `${monthNames[month]} ${year}`;
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    calendarDates.innerHTML = "";
    for(let i = 0; i < firstDay; i++){ calendarDates.appendChild(document.createElement("div")); }
    for(let day = 1; day <= totalDays; day++){
        const dayBox = document.createElement("div");
        dayBox.innerText = day;
        if(day === now.getDate()) dayBox.classList.add("active-date");
        calendarDates.appendChild(dayBox);
    }
}
generateCalendar();

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
loadHolidays();

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
    { email: "sakthi", password: "NRIN014", name: "Sakthi Prasanna S", role: "intern" }
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
        // Ensure BOTH are included in this check
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
        table.innerHTML = "";
        const today = new Date().toISOString().split('T')[0];

        try {
            const snapshot = await getDocs(collection(db,"tasks"));
            let taskList = [];
            snapshot.forEach(docSnap => {
                taskList.push({ id: docSnap.id, ...docSnap.data() });
            });

            taskList.sort((a, b) => {
                const projA = a.project || "None";
                const projB = b.project || "None";
                if (projA !== projB) return projA.localeCompare(projB);
                
                const isTodayA = a.startDate === today ? 0 : 1;
                const isTodayB = b.startDate === today ? 0 : 1;
                return isTodayA - isTodayB;
            });

            taskList.forEach((task)=>{
                const taskId = task.id;
                // Stronger escaping for newlines and double quotes
                const escTitle = (task.title || "").replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, "\\n").replace(/\r/g, "");
                const escDesc = (task.description || "").replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, "\\n").replace(/\r/g, "");
                const escEmp = (task.employee || "").replace(/'/g, "\\'").replace(/"/g, "&quot;");
                const escProj = (task.project || "None").replace(/'/g, "\\'").replace(/"/g, "&quot;");
                table.innerHTML += `
                <tr>
                    <td>${task.title}</td>
                    <td><span style="background:#1e293b; color: white; padding:4px 8px; border-radius:4px; font-size:12px;">${task.project || 'None'}</span></td>
                    <td>${task.employee}</td>
                    <td style="font-size: 12px;">S: ${task.startDate || 'N/A'}<br>E: ${task.endDate || 'N/A'}</td>
                    <td>${task.status}</td>
                    <td>${task.remarks || ''}</td>
                    <td>
                        <button class="action-btn edit-btn" onclick="TaskTracker.editTask('${taskId}', '${escTitle}', '${escDesc}', '${escEmp}', '${escProj}', '${task.startDate}', '${task.endDate}')">Edit</button>
                        <button class="action-btn delete-btn" onclick="TaskTracker.deleteTask('${taskId}')">Delete</button>
                    </td>
                </tr>`;
            });
        } catch(error){ console.error(error); }
    },

    async renderEmployeeTasks(){
        const table = document.getElementById("employeeTaskTable");
        if(!table) return;
        table.innerHTML = "";

        const currentUser = JSON.parse(sessionStorage.getItem("loggedInUser")); 
        if(!currentUser) return;

        try {
            const snapshot = await getDocs(collection(db,"tasks"));
            snapshot.forEach((taskDoc)=>{
                const task = taskDoc.data();
                if(task.employee === currentUser.name){
                    table.innerHTML += `
                    <tr>
                        <td><strong>${task.project || 'None'}</strong></td>
                        <td>${task.title}</td>
                        <td>${task.description}</td>
                        <td>${task.startDate || 'N/A'}</td>
                        <td>${task.endDate || 'N/A'}</td>
                        <td>
                            <select class="status-select" id="status-${taskDoc.id}">
                                <option ${task.status === "Not Started Yet" ? "selected" : ""}>Not Started Yet</option>
                                <option ${task.status === "Work In Progress" ? "selected" : ""}>Work In Progress</option>
                                <option ${task.status === "Work Done" ? "selected" : ""}>Work Done</option>
                            </select>
                        </td>
                        <td>
                            <textarea 
                                class="remark-box" 
                                id="remark-${taskDoc.id}" 
                                oninput="this.style.height = ''; this.style.height = this.scrollHeight + 'px'">${task.remarks || ""}
                            </textarea>
                        </td>
                       <td><button id="saveBtn-${taskDoc.id}" class="save-btn" onclick="TaskTracker.updateTask('${taskDoc.id}')">Save</button></td>
                    </tr>`;
                }
            });
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
                    totalLeaveDays += (l.dayType === 'Full') ? 1 : 0.5;
                }
            });

            const reportDateElem = document.getElementById("reportDate");
            if (reportDateElem) {
                reportDateElem.innerText = `${new Date().toLocaleDateString()} | Total Leaves Taken: ${totalLeaveDays} Days`;
            }

            // --- 2. Fetch & Load Tasks (Sorted by Date) ---
            const taskSnap = await getDocs(collection(db, "tasks"));
            let employeeTasks = [];
            
            taskSnap.forEach(docSnap => {
                const task = docSnap.data();
                if(task.employee === employeeName) {
                    employeeTasks.push(task);
                }
            });

            // Sort tasks by 'createdAt' date (newest at the top)
            employeeTasks.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

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
                if(att.employee === employeeName) attRecords.push(att);
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

        const today = getLocalDate(); 
        const nowTime = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
        const nowMs = Date.now(); 
        
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
        
        const now = new Date();
        const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const today = now.getDate();

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
        
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
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

            leaves.sort((a,b) => new Date(b.appliedAt) - new Date(a.appliedAt));

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
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const id = docSnap.id;
                
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
                let currentDate = new Date(fromDate);
                const endDate = new Date(toDate);
                
                while (currentDate <= endDate) {
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

window.onload = () => {
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

    TaskTracker.renderAdminProjects(); 
    TaskTracker.renderAdminTasks();
    TaskTracker.renderEmployeeTasks();
    TaskTracker.renderFullCalendar();
};

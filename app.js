import {
    db, collection, addDoc, getDocs, updateDoc, deleteDoc, doc
} from "./firebase.js";

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
    { email: "karthik", password: "NRIN02", name: "Murali karthik Kuchan", role: "employee" },
    { email: "javid", password: "NRIN03", name: "Mohammed Javid Jafir N", role: "employee" },
    { email: "rushil", password: "NRIN04", name: "Rushil Kumar M", role: "employee" },
    { email: "aravindhanathan", password: "NRIN05", name: "Aravindhanathan Gurumoorthy", role: "employee" },
    { email: "sreenandini", password: "NRIN06", name: "Sreenandini M", role: "employee" },
    { email: "guganeshwaran", password: "NRIN07", name: "Guganeshwaran S", role: "employee" },
    { email: "sruthi", password: "NRIN08", name: "Sruthi Raj R", role: "employee" },
    { email: "sriharish", password: "NRIN09", name: "Sriharish S R", role: "employee" },
    { email: "siva", password: "NRIN010", name: "Siva S", role: "employee" },
    { email: "premkumar", password: "NRIN011", name: "Premkumar G", role: "employee" },
    { email: "kunal", password: "NRIN012", name: "Kunal Ramteke", role: "employee" },
    { email: "vigneshwaran", password: "NRIN013", name: "Vigneshwaran K", role: "employee" },
    { email: "sakthi", password: "NRIN014", name: "Sakthi Prasanna S", role: "employee" }
];

function populateEmployeeDropdown() {
    const select = document.getElementById("employeeSelect");
    if (!select) return;
    select.innerHTML = "";
    users.forEach(user => {
        if (user.role === "employee") {
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
        if(user.role === "employee"){
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

// ---------------- MAIN APP ----------------
const currentPage = window.location.pathname.split("/").pop();

const TaskTracker = {
  switchAdminView(view) {
        const views = {
            'tasks': document.getElementById("adminTasksView"),
            'employees': document.getElementById("adminEmployeesView"),
            'projects': document.getElementById("adminProjectsView"),
            'calendar': document.getElementById("adminCalendarView"),
            'employeeDetails': document.getElementById("adminEmployeeDetailsView"),
            'attendance': document.getElementById("adminAttendanceView") // <-- ADDED THIS LINE
        };
        const links = document.querySelectorAll(".sidebar a");

        Object.values(views).forEach(v => { if(v) v.style.display = "none"; });
        links.forEach(l => l.classList.remove("active"));

        if (view === "tasks" && views.tasks) {
            views.tasks.style.display = "block";
            if(links[0]) links[0].classList.add("active");
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
        } else if (view === "attendance" && views.attendance) { // <-- ADDED THIS BLOCK
            views.attendance.style.display = "block";
            if(links[4]) links[4].classList.add("active"); // Assumes Attendance is the 5th link
            this.renderAdminAttendance();
        }
    },

    login(){
        const email = document.getElementById("email")?.value.trim();
        const password = document.getElementById("password")?.value.trim();
        const user = users.find(u => u.email === email && u.password === password);

        if(!user){ alert("Invalid Email or Password"); return; }
        localStorage.setItem("loggedInUser", JSON.stringify(user));
        window.location.href = user.role === "admin" ? "admin.html" : "employee.html";
    },

    checkAuth(){
        if(currentPage === "index.html" || currentPage === "") return;
        const user = JSON.parse(localStorage.getItem("loggedInUser"));
        if(!user && currentPage !== "login.html"){
            window.location.href = "login.html"; return;
        }
        const username = document.getElementById("username");
        if(username && user) username.innerText = `${user.name} (${user.role})`;
    },

    logout(){
        localStorage.removeItem("loggedInUser");
        window.location.href = "index.html";
    },

    // --- PROJECT LOGIC ---
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
                
                // Fill Table
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

                // Fill Dropdown in Task Form
                if(select) {
                    const opt = document.createElement("option");
                    opt.value = proj.name;
                    opt.innerText = proj.name;
                    select.appendChild(opt);
                }
            });
        } catch(e) { console.error(e); }
    },

    // --- TASK LOGIC ---
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
        } catch(error){ console.error(error); alert("Firebase operation failed"); }
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

            // Sorting Logic: Group by Project, then prioritize Today's Tasks
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
                const escTitle = (task.title || "").replace(/'/g, "\\'");
                const escDesc = (task.description || "").replace(/'/g, "\\'");
                const escEmp = (task.employee || "").replace(/'/g, "\\'");
                const escProj = (task.project || "None").replace(/'/g, "\\'");

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

        const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
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
                        <td><button class="save-btn" onclick="TaskTracker.updateTask('${taskDoc.id}')">Save</button></td>
                    </tr>`;
                }
            });
        } catch(error){ console.error(error); }
    },

    async updateTask(id){
        try{
            const status = document.getElementById(`status-${id}`).value;
            const remarks = document.getElementById(`remark-${id}`).value;
            await updateDoc(doc(db,"tasks",id),{ status, remarks });
            alert("Task Updated Successfully");
            this.renderEmployeeTasks();
        } catch(error){ console.error(error); }
    },

    // --- EMPLOYEE PDF REPORT LOGIC ---
    async viewEmployeeDetails(employeeName) {
        this.switchAdminView('employeeDetails');
        document.getElementById("reportEmployeeName").innerText = employeeName;
        document.getElementById("reportDate").innerText = new Date().toLocaleDateString();
        
        const table = document.getElementById("reportTaskTable");
        table.innerHTML = "";

        try {
            const snapshot = await getDocs(collection(db, "tasks"));
            snapshot.forEach(docSnap => {
                const task = docSnap.data();
                if(task.employee === employeeName) {
                    table.innerHTML += `
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
            
            if(table.innerHTML === "") {
                table.innerHTML = "<tr><td colspan='6' style='text-align:center; color: black;'>No tasks assigned to this employee.</td></tr>";
            }
        } catch(e) { console.error(e); }
    },

    downloadPDF() {
        const element = document.getElementById('pdfReportArea');
        const empName = document.getElementById("reportEmployeeName").innerText;
        
        const opt = {
            margin:       0.5,
            filename:     `${empName.replace(/\s+/g, '_')}_Task_Report.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
        };

        html2pdf().set(opt).from(element).save();
    },

// --- CALENDAR DASHBOARD LOGIC ---
    async renderFullCalendar() {
        const calendarGrid = document.getElementById("mainCalendarGrid");
        if (!calendarGrid) return;
        calendarGrid.innerHTML = "";
        
        const now = new Date();
        const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

        for (let day = 1; day <= totalDays; day++) {
            const dayDiv = document.createElement("div");
            dayDiv.innerText = day;
            dayDiv.className = "calendar-day";
            // Ensure the click event is properly bound to fetch the data
            dayDiv.onclick = () => this.showTasksForDate(day);
            calendarGrid.appendChild(dayDiv);
        }
    },

    async showTasksForDate(day) {
        const table = document.getElementById("calendarTaskTable");
        const titleElement = document.getElementById("selectedDateTasksTitle");
        
        // Format the date to strictly match YYYY-MM-DD
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const formattedDate = `${year}-${month}-${String(day).padStart(2, '0')}`;
        
        titleElement.innerText = `Tasks for ${formattedDate}`;
        table.innerHTML = "<tr><td colspan='3' style='text-align:center;'>Loading tasks...</td></tr>";

        try {
            const snapshot = await getDocs(collection(db, "tasks"));
            table.innerHTML = ""; // Clear the loading message
            let hasTasks = false;

            snapshot.forEach(doc => {
                const task = doc.data();
                // Check if the task's start date matches the clicked date
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

            // If no tasks matched that date, tell the user
            if (!hasTasks) {
                table.innerHTML = `<tr><td colspan='3' style='text-align:center; color:#94a3b8;'>No tasks assigned for this date.</td></tr>`;
            }

        } catch (error) {
            console.error("Firebase Error: ", error);
            table.innerHTML = "<tr><td colspan='3' style='text-align:center; color:#ef4444;'>Error loading tasks. Check console.</td></tr>";
        }
     }
    };
window.TaskTracker = TaskTracker;

window.onload = () => {
    updateClockAndDate();
    generateCalendar();
    loadHolidays();
    populateEmployeeDropdown();
    TaskTracker.renderAdminProjects(); 
    TaskTracker.checkAuth();
    TaskTracker.renderAdminTasks();
    TaskTracker.renderEmployeeTasks();
    TaskTracker.renderFullCalendar();
};

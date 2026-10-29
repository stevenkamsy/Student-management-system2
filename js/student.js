// student.js - code used only by the student portal

requireRole("student");

// ---------- Page elements ----------
const registerSection = document.getElementById("registerSection");
const dashboardSection = document.getElementById("dashboardSection");
const registerForm = document.getElementById("registerForm");
const registerErrors = document.getElementById("registerErrors");
const studentLoginForm = document.getElementById("studentLoginForm");
const studentLoginMessage = document.getElementById("studentLoginMessage");
const addCourseForm = document.getElementById("addCourseForm");
const addCourseMessage = document.getElementById("addCourseMessage");

// ---------- Helpers ----------

// Position of the signed-in student in the saved list, or -1 if nobody is signed in
function getCurrentStudentIndex() {
  const matric = localStorage.getItem("currentStudent");
  if (matric === null) {
    return -1;
  }
  return findStudentIndex(matric);
}

// Show a list of error messages inside a red alert box
function showErrors(box, errorList) {
  let html = "<ul class='mb-0'>";
  for (let i = 0; i < errorList.length; i++) {
    html += "<li>" + escapeHtml(errorList[i]) + "</li>";
  }
  html += "</ul>";
  box.innerHTML = html;
  box.classList.remove("d-none");
}

function hideErrors(box) {
  box.innerHTML = "";
  box.classList.add("d-none");
}

// Decide whether to show the registration page or the dashboard
function showCorrectView() {
  if (getCurrentStudentIndex() === -1) {
    registerSection.classList.remove("d-none");
    dashboardSection.classList.add("d-none");
  } else {
    registerSection.classList.add("d-none");
    dashboardSection.classList.remove("d-none");
    renderDashboard();
  }
}

// ---------- Course checkboxes on the registration form ----------
function buildCourseCheckboxes() {
  const container = document.getElementById("courseCheckboxes");
  let html = "";
  for (let i = 0; i < AVAILABLE_COURSES.length; i++) {
    const course = AVAILABLE_COURSES[i];
    html += `<div class="form-check">
               <input class="form-check-input course-checkbox" type="checkbox"
                      id="course_${i}" value="${i}">
               <label class="form-check-label" for="course_${i}">
                 ${escapeHtml(course.code)} - ${escapeHtml(course.title)}
               </label>
             </div>`;
  }
  container.innerHTML = html;
}

// ---------- REGISTRATION ----------
registerForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const errors = [];

  const fullName = document.getElementById("fullName").value.trim();
  const matric = normalizeMatric(document.getElementById("matricNumber").value);
  const department = document.getElementById("department").value.trim();
  const level = document.getElementById("level").value;
  const email = document.getElementById("email").value.trim();
  const customCode = document.getElementById("customCourseCode").value.trim().toUpperCase();
  const customTitle = document.getElementById("customCourseTitle").value.trim();

  // 1. Required fields
  if (fullName === "") { errors.push("Full name is required."); }
  if (matric === "") { errors.push("Matriculation number is required."); }
  if (department === "") { errors.push("Department is required."); }
  if (level === "") { errors.push("Please choose your level."); }

  // 2. Email is optional, but if typed it must look like an email
  if (email !== "" && !document.getElementById("email").checkValidity()) {
    errors.push("Enter a valid email address, or leave the email field empty.");
  }

  // 3. Duplicate matric number
  if (matric !== "" && findStudentIndex(matric) !== -1) {
    errors.push("This matriculation number is already registered.");
  }

  // 4. Courses: ticked boxes first, then the custom course
  const chosenCourses = [];
  const checkboxes = document.getElementsByClassName("course-checkbox");
  for (let i = 0; i < checkboxes.length; i++) {
    if (checkboxes[i].checked) {
      const course = AVAILABLE_COURSES[Number(checkboxes[i].value)];
      chosenCourses.push({ code: course.code, title: course.title });
    }
  }

  if (customCode !== "" || customTitle !== "") {
    if (customCode === "" || customTitle === "") {
      errors.push("For your own course, enter BOTH the course code and the course title.");
    } else if (!courseExists(chosenCourses, customCode)) {
      chosenCourses.push({ code: customCode, title: customTitle });
    }
  }

  if (chosenCourses.length === 0) {
    errors.push("Choose or enter at least one course.");
  }

  // 5. Stop if there are any errors
  if (errors.length > 0) {
    showErrors(registerErrors, errors);
    return;
  }

  // 6. Everything is fine: save the new student
  hideErrors(registerErrors);
  const students = loadStudents();
  students.push({
    name: fullName,
    matric: matric,
    department: department,
    level: level,
    email: email,
    courses: chosenCourses
  });
  if (!saveStudents(students)) {
    return;
  }

  localStorage.setItem("currentStudent", matric);
  registerForm.reset();
  showCorrectView();
});

// ---------- RETURNING STUDENT ----------
studentLoginForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const matric = normalizeMatric(document.getElementById("loginMatric").value);

  if (matric === "") {
    studentLoginMessage.textContent = "Please enter your matriculation number.";
  } else if (findStudentIndex(matric) === -1) {
    studentLoginMessage.textContent = "No student found with that matriculation number. Please register.";
  } else {
    studentLoginMessage.textContent = "";
    localStorage.setItem("currentStudent", matric);
    studentLoginForm.reset();
    showCorrectView();
  }
});

// ---------- DASHBOARD ----------
function renderDashboard() {
  const students = loadStudents();
  const student = students[getCurrentStudentIndex()];
  const overall = getOverallAttendance(student);

  // Student details card
  let emailText = "Not provided";
  if (student.email !== "") {
    emailText = student.email;
  }
  document.getElementById("studentInfo").innerHTML = `
    <div class="card shadow-sm"><div class="card-body">
      <h2 class="h4 mb-1">${escapeHtml(student.name)}</h2>
      <p class="mb-0 text-muted">
        Matric No: <strong>${escapeHtml(student.matric)}</strong> |
        Department: <strong>${escapeHtml(student.department)}</strong> |
        Level: <strong>${escapeHtml(student.level)}</strong> |
        Email: ${escapeHtml(emailText)}
      </p>
    </div></div>`;

  // Summary cards
  let percentText = "N/A";
  if (overall.percent !== null) {
    percentText = overall.percent + "%";
  }
  document.getElementById("summaryCards").innerHTML = `
    <div class="col-12 col-md-4">
      <div class="card summary-card"><div class="card-body">
        <div class="text-muted small">Sessions recorded</div>
        <div class="number">${overall.total}</div>
      </div></div>
    </div>
    <div class="col-12 col-md-4">
      <div class="card summary-card"><div class="card-body">
        <div class="text-muted small">Sessions attended</div>
        <div class="number">${overall.attended}</div>
      </div></div>
    </div>
    <div class="col-12 col-md-4">
      <div class="card summary-card"><div class="card-body">
        <div class="text-muted small">Overall attendance</div>
        <div class="number">${percentText}</div>
      </div></div>
    </div>`;

  // Simple summary message
  let summaryHtml = "";
  if (overall.percent === null) {
    summaryHtml = `<div class="alert alert-secondary mb-0">No attendance has been recorded for you yet.</div>`;
  } else if (overall.percent >= ATTENDANCE_THRESHOLD) {
    summaryHtml = `<div class="alert alert-success mb-0">
      Good progress. Your attendance is at or above ${ATTENDANCE_THRESHOLD}%.</div>`;
  } else {
    summaryHtml = `<div class="alert alert-danger mb-0">
      Your attendance is below ${ATTENDANCE_THRESHOLD}%. Please try to attend more classes.</div>`;
  }
  document.getElementById("summaryMessage").innerHTML = summaryHtml;

  renderCourseList(student);
  renderAttendanceHistory(student);
}

// Table of the student's courses with attendance per course
function renderCourseList(student) {
  const listBox = document.getElementById("courseList");

  if (student.courses.length === 0) {
    listBox.innerHTML = `<p class="text-muted">You have not registered any courses yet. Add one below.</p>`;
    return;
  }

  let rows = "";
  for (let i = 0; i < student.courses.length; i++) {
    const course = student.courses[i];
    const result = getCourseAttendance(student.matric, course.code);

    rows += `<tr>
               <td>${escapeHtml(course.code)}</td>
               <td>${escapeHtml(course.title)}</td>
               <td>${result.attended} / ${result.total}</td>
               <td style="min-width:160px;">${makeProgressBar(result.percent)}</td>
               <td><button type="button" class="btn btn-sm btn-outline-danger"
                           onclick="removeCourse(${i})">Remove</button></td>
             </tr>`;
  }

  listBox.innerHTML = `
    <div class="table-responsive">
      <table class="table table-striped align-middle">
        <thead class="table-primary">
          <tr><th>Code</th><th>Title</th><th>Attended</th><th>Attendance</th><th></th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// Table of attendance records (view only)
function renderAttendanceHistory(student) {
  const historyBox = document.getElementById("attendanceHistory");
  const sessions = loadSessions();
  let rows = "";

  for (let i = 0; i < sessions.length; i++) {
    for (let j = 0; j < sessions[i].records.length; j++) {
      const record = sessions[i].records[j];
      if (record.matric === student.matric) {
        let badge = "bg-danger";
        if (record.status === "Present") {
          badge = "bg-success";
        }
        rows += `<tr>
                   <td>${escapeHtml(sessions[i].date)}</td>
                   <td>${escapeHtml(sessions[i].courseCode)}</td>
                   <td><span class="badge ${badge}">${escapeHtml(record.status)}</span></td>
                 </tr>`;
      }
    }
  }

  if (rows === "") {
    historyBox.innerHTML = `<p class="text-muted mb-0">No attendance records are available yet.</p>`;
    return;
  }

  historyBox.innerHTML = `
    <div class="table-responsive">
      <table class="table table-striped">
        <thead class="table-primary"><tr><th>Date</th><th>Course</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ---------- ADD A COURSE ----------
addCourseForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const code = document.getElementById("newCourseCode").value.trim().toUpperCase();
  const title = document.getElementById("newCourseTitle").value.trim();

  if (code === "" || title === "") {
    addCourseMessage.innerHTML = `<div class="text-danger">Please enter both the course code and the course title.</div>`;
    return;
  }

  const students = loadStudents();
  const studentIndex = getCurrentStudentIndex();

  if (courseExists(students[studentIndex].courses, code)) {
    addCourseMessage.innerHTML = `<div class="text-danger">You have already registered ${escapeHtml(code)}.</div>`;
    return;
  }

  students[studentIndex].courses.push({ code: code, title: title });
  if (!saveStudents(students)) {
    return;
  }

  addCourseForm.reset();
  addCourseMessage.innerHTML = `<div class="text-success">Course added.</div>`;
  renderDashboard();
});

// ---------- REMOVE A COURSE ----------
// Called from the Remove buttons (onclick) in the course table
function removeCourse(courseIndex) {
  const students = loadStudents();
  const studentIndex = getCurrentStudentIndex();
  const course = students[studentIndex].courses[courseIndex];

  const sure = confirm("Remove " + course.code + " from your courses?");
  if (!sure) {
    return;
  }

  // Build a new list that leaves out the removed course
  const remaining = [];
  for (let i = 0; i < students[studentIndex].courses.length; i++) {
    if (i !== courseIndex) {
      remaining.push(students[studentIndex].courses[i]);
    }
  }
  students[studentIndex].courses = remaining;
  if (!saveStudents(students)) {
    return;
  }

  addCourseMessage.innerHTML = "";
  renderDashboard();
}

// ---------- START ----------
buildCourseCheckboxes();
showCorrectView();
console.log("student.js loaded");

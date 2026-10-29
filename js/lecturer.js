// lecturer.js - code used only by the lecturer portal

requireRole("lecturer");

// ---------- Page elements ----------
const searchInput = document.getElementById("searchInput");
const departmentFilter = document.getElementById("departmentFilter");
const levelFilter = document.getElementById("levelFilter");
const courseFilter = document.getElementById("courseFilter");
const courseSelect = document.getElementById("courseSelect");
const dateInput = document.getElementById("dateInput");
const attendanceMessage = document.getElementById("attendanceMessage");
const attendanceSheet = document.getElementById("attendanceSheet");
const exportCsvButton = document.getElementById("exportCsvBtn");

// Attendance should only be recorded for today or an earlier date.
const today = new Date();
const localToday = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
dateInput.max = localToday;

// Remember what the attendance sheet on screen is for
let sheetCourse = "";
let sheetDate = "";
let sheetMatrics = [];   // matric numbers of the students listed on the sheet

// =====================================================
// DASHBOARD
// =====================================================
function renderDashboard() {
  const students = loadStudents();
  const sessions = loadSessions();
  const courses = getCoursesInUse();

  // Go through every student and collect low-attendance students
  const lowStudents = [];
  let percentTotal = 0;
  let percentCount = 0;

  for (let i = 0; i < students.length; i++) {
    const overall = getOverallAttendance(students[i]);
    if (overall.percent !== null) {
      percentTotal = percentTotal + overall.percent;
      percentCount++;
      if (overall.percent < ATTENDANCE_THRESHOLD) {
        lowStudents.push({ name: students[i].name, matric: students[i].matric, percent: overall.percent });
      }
    }
  }

  // Summary cards
  document.getElementById("dashboardCards").innerHTML = `
    <div class="col-6 col-lg-3"><div class="card summary-card"><div class="card-body">
      <div class="text-muted small">Registered students</div>
      <div class="number">${students.length}</div></div></div></div>
    <div class="col-6 col-lg-3"><div class="card summary-card"><div class="card-body">
      <div class="text-muted small">Courses</div>
      <div class="number">${courses.length}</div></div></div></div>
    <div class="col-6 col-lg-3"><div class="card summary-card"><div class="card-body">
      <div class="text-muted small">Sessions recorded</div>
      <div class="number">${sessions.length}</div></div></div></div>
    <div class="col-6 col-lg-3"><div class="card summary-card"><div class="card-body">
      <div class="text-muted small">Low attendance (below ${ATTENDANCE_THRESHOLD}%)</div>
      <div class="number">${lowStudents.length}</div></div></div></div>`;

  // Performance overview
  const overviewBox = document.getElementById("performanceOverview");
  if (percentCount === 0) {
    overviewBox.innerHTML = `<p class="text-muted mb-0">No attendance has been recorded yet.</p>`;
  } else {
    const average = Math.round(percentTotal / percentCount);
    overviewBox.innerHTML = `
      <p class="mb-2">Average attendance across students: <strong>${average}%</strong></p>
      ${makeProgressBar(average)}`;
  }

  // Low attendance list
  const lowBox = document.getElementById("lowAttendanceList");
  if (percentCount === 0) {
    lowBox.innerHTML = `<p class="text-muted mb-0">No attendance data yet.</p>`;
  } else if (lowStudents.length === 0) {
    lowBox.innerHTML = `<p class="text-success mb-0">No student is below ${ATTENDANCE_THRESHOLD}%.</p>`;
  } else {
    let html = `<ul class="list-group">`;
    for (let i = 0; i < lowStudents.length; i++) {
      html += `<li class="list-group-item d-flex justify-content-between">
                 <span>${escapeHtml(lowStudents[i].name)} (${escapeHtml(lowStudents[i].matric)})</span>
                 <span class="badge bg-danger">${lowStudents[i].percent}%</span>
               </li>`;
    }
    html += `</ul>`;
    lowBox.innerHTML = html;
  }
}

// =====================================================
// STUDENT TABLE: search and filters
// =====================================================

// Add a value to a list only if it is not already there
function addIfNew(list, value) {
  for (let i = 0; i < list.length; i++) {
    if (list[i] === value) {
      return;
    }
  }
  list.push(value);
}

// Fill a <select> with options, keeping the current choice if possible
function fillSelect(select, firstLabel, values) {
  const previous = select.value;
  let html = `<option value="">${firstLabel}</option>`;
  for (let i = 0; i < values.length; i++) {
    html += `<option value="${escapeHtml(values[i])}">${escapeHtml(values[i])}</option>`;
  }
  select.innerHTML = html;
  select.value = previous;
}

function populateFilters() {
  const students = loadStudents();
  const departments = [];
  const levels = [];

  for (let i = 0; i < students.length; i++) {
    addIfNew(departments, students[i].department);
    addIfNew(levels, students[i].level);
  }

  const courseCodes = [];
  const coursesInUse = getCoursesInUse();
  for (let i = 0; i < coursesInUse.length; i++) {
    courseCodes.push(coursesInUse[i].code);
  }

  fillSelect(departmentFilter, "All departments", departments);
  fillSelect(levelFilter, "All levels", levels);
  fillSelect(courseFilter, "All courses", courseCodes);
}

function renderStudentTable() {
  const students = loadStudents();
  const searchText = searchInput.value.trim().toLowerCase();
  const wantedDepartment = departmentFilter.value;
  const wantedLevel = levelFilter.value;
  const wantedCourse = courseFilter.value;

  let rows = "";
  let shown = 0;

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    let matches = true;

    // Search by name or matric number
    if (searchText !== "") {
      const inName = student.name.toLowerCase().indexOf(searchText) !== -1;
      const inMatric = student.matric.toLowerCase().indexOf(searchText) !== -1;
      if (!inName && !inMatric) { matches = false; }
    }
    if (wantedDepartment !== "" && student.department !== wantedDepartment) { matches = false; }
    if (wantedLevel !== "" && student.level !== wantedLevel) { matches = false; }
    if (wantedCourse !== "" && !studentHasCourse(student, wantedCourse)) { matches = false; }

    if (matches) {
      shown++;
      const overall = getOverallAttendance(student);

      let courseCodes = "";
      for (let j = 0; j < student.courses.length; j++) {
        if (j > 0) { courseCodes += ", "; }
        courseCodes += student.courses[j].code;
      }

      rows += `<tr>
                 <td>${escapeHtml(student.name)}</td>
                 <td>${escapeHtml(student.matric)}</td>
                 <td>${escapeHtml(student.department)}</td>
                 <td>${escapeHtml(student.level)}</td>
                 <td>${escapeHtml(courseCodes)}</td>
                 <td>${makeProgressBar(overall.percent)}</td>
                 <td><button type="button" class="btn btn-sm btn-dark"
                             onclick="viewStudent(${i})">View</button></td>
               </tr>`;
    }
  }

  if (students.length === 0) {
    rows = `<tr><td colspan="7" class="text-muted">No students registered yet. Students can register in the
            Student Portal, or use "Load sample data" at the bottom of this page.</td></tr>`;
  } else if (shown === 0) {
    rows = `<tr><td colspan="7" class="text-muted">No students match your search or filters.</td></tr>`;
  }

  document.getElementById("studentCount").textContent = "Showing " + shown + " of " + students.length + " students";
  document.getElementById("studentTableBody").innerHTML = rows;
}

// Show one student's full details in the pop-up (modal)
function viewStudent(index) {
  const students = loadStudents();
  const student = students[index];
  const overall = getOverallAttendance(student);

  let emailText = "Not provided";
  if (student.email !== "") {
    emailText = student.email;
  }

  // Attendance per course
  let courseRows = "";
  for (let i = 0; i < student.courses.length; i++) {
    const course = student.courses[i];
    const result = getCourseAttendance(student.matric, course.code);
    courseRows += `<tr>
                     <td>${escapeHtml(course.code)}</td>
                     <td>${escapeHtml(course.title)}</td>
                     <td>${result.attended} / ${result.total}</td>
                     <td style="min-width:160px;">${makeProgressBar(result.percent)}</td>
                   </tr>`;
  }

  // Attendance history
  const sessions = loadSessions();
  let historyRows = "";
  for (let i = 0; i < sessions.length; i++) {
    for (let j = 0; j < sessions[i].records.length; j++) {
      const record = sessions[i].records[j];
      if (record.matric === student.matric) {
        let badge = "bg-danger";
        if (record.status === "Present") { badge = "bg-success"; }
        historyRows += `<tr>
                          <td>${escapeHtml(sessions[i].date)}</td>
                          <td>${escapeHtml(sessions[i].courseCode)}</td>
                          <td><span class="badge ${badge}">${escapeHtml(record.status)}</span></td>
                        </tr>`;
      }
    }
  }
  if (historyRows === "") {
    historyRows = `<tr><td colspan="3" class="text-muted">No attendance records yet.</td></tr>`;
  }

  document.getElementById("studentModalBody").innerHTML = `
    <h5>${escapeHtml(student.name)}</h5>
    <p class="text-muted">
      Matric No: ${escapeHtml(student.matric)}<br>
      Department: ${escapeHtml(student.department)} | Level: ${escapeHtml(student.level)}<br>
      Email: ${escapeHtml(emailText)}
    </p>
    <p><strong>Overall attendance:</strong></p>
    ${makeProgressBar(overall.percent)}

    <h6 class="mt-4">Registered courses</h6>
    <div class="table-responsive">
      <table class="table table-sm align-middle">
        <thead><tr><th>Code</th><th>Title</th><th>Attended</th><th>Attendance</th></tr></thead>
        <tbody>${courseRows}</tbody>
      </table>
    </div>

    <h6 class="mt-4">Attendance history</h6>
    <div class="table-responsive">
      <table class="table table-sm">
        <thead><tr><th>Date</th><th>Course</th><th>Status</th></tr></thead>
        <tbody>${historyRows}</tbody>
      </table>
    </div>`;

  // Open the Bootstrap modal
  const modal = new bootstrap.Modal(document.getElementById("studentModal"));
  modal.show();
}

// =====================================================
// ATTENDANCE MARKING
// =====================================================

function populateCourseSelect() {
  const courses = getCoursesInUse();
  const previous = courseSelect.value;

  let html = `<option value="">Choose a course</option>`;
  for (let i = 0; i < courses.length; i++) {
    html += `<option value="${escapeHtml(courses[i].code)}">
               ${escapeHtml(courses[i].code)} - ${escapeHtml(courses[i].title)}
             </option>`;
  }
  courseSelect.innerHTML = html;
  courseSelect.value = previous;
}

// Find a saved session for this course and date. Returns its index, or -1.
function findSessionIndex(courseCode, date) {
  const sessions = loadSessions();
  for (let i = 0; i < sessions.length; i++) {
    if (sessions[i].courseCode === courseCode && sessions[i].date === date) {
      return i;
    }
  }
  return -1;
}

// Look up one student's saved status in a list of records. Returns null if not found.
function getStatusFromRecords(records, matric) {
  for (let i = 0; i < records.length; i++) {
    if (records[i].matric === matric) {
      return records[i].status;
    }
  }
  return null;
}

function showAttendanceMessage(type, text) {
  attendanceMessage.innerHTML = `<div class="alert alert-${type}">${escapeHtml(text)}</div>`;
}

function clearAttendanceSheet() {
  attendanceSheet.innerHTML = "";
  attendanceMessage.innerHTML = "";
  sheetMatrics = [];
}

// Build the Present / Absent sheet for the chosen course and date
function loadAttendanceSheet() {
  const courseCode = courseSelect.value;
  const date = dateInput.value;

  if (courseCode === "" || date === "") {
    clearAttendanceSheet();
    showAttendanceMessage("danger", "Please choose a course and a date first.");
    return;
  }
  if (date > localToday) {
    clearAttendanceSheet();
    showAttendanceMessage("danger", "Future dates cannot be used for attendance. Choose today or a past date.");
    return;
  }

  const students = loadStudents();
  const sessions = loadSessions();
  const existingIndex = findSessionIndex(courseCode, date);

  let existingRecords = [];
  if (existingIndex !== -1) {
    existingRecords = sessions[existingIndex].records;
  }

  sheetCourse = courseCode;
  sheetDate = date;
  sheetMatrics = [];
  let rows = "";

  for (let i = 0; i < students.length; i++) {
    if (studentHasCourse(students[i], courseCode)) {
      const position = sheetMatrics.length;   // 0, 1, 2 ... used to name the radio buttons
      sheetMatrics.push(students[i].matric);

      // Do not preselect a status for a new session. This prevents accidentally
      // marking an entire class Present without checking each student.
      let presentChecked = "";
      let absentChecked = "";
      const savedStatus = getStatusFromRecords(existingRecords, students[i].matric);
      if (savedStatus === "Present") {
        presentChecked = "checked";
      } else if (savedStatus === "Absent") {
        absentChecked = "checked";
      }

      rows += `<tr>
                 <td>${escapeHtml(students[i].name)}</td>
                 <td>${escapeHtml(students[i].matric)}</td>
                 <td>
                   <div class="btn-group" role="group">
                     <input type="radio" class="btn-check" name="status_${position}"
                            id="present_${position}" value="Present" ${presentChecked}>
                     <label class="btn btn-outline-success" for="present_${position}">Present</label>
                     <input type="radio" class="btn-check" name="status_${position}"
                            id="absent_${position}" value="Absent" ${absentChecked}>
                     <label class="btn btn-outline-danger" for="absent_${position}">Absent</label>
                   </div>
                 </td>
               </tr>`;
    }
  }

  attendanceMessage.innerHTML = "";

  if (sheetMatrics.length === 0) {
    attendanceSheet.innerHTML = "";
    showAttendanceMessage("secondary", "No students are registered for this course.");
    return;
  }

  // Warn if this course and date already has a session
  if (existingIndex !== -1) {
    showAttendanceMessage("warning",
      "A session for " + courseCode + " on " + date + " already exists. " +
      "Saving will UPDATE (correct) that session.");
  }

  attendanceSheet.innerHTML = `
    <div class="table-responsive">
      <table class="table table-striped align-middle">
        <thead class="table-dark"><tr><th>Name</th><th>Matric No.</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <button type="button" class="btn btn-success btn-lg" onclick="saveAttendance()">
      Save attendance session
    </button>`;
}

// Save the sheet (new session, or a correction of an existing one)
function saveAttendance() {
  if (sheetMatrics.length === 0) {
    return;
  }

  // Read every radio button on the sheet
  const records = [];
  for (let i = 0; i < sheetMatrics.length; i++) {
    const presentButton = document.getElementById("present_" + i);
    const absentButton = document.getElementById("absent_" + i);
    if (!presentButton.checked && !absentButton.checked) {
      showAttendanceMessage("danger", "Please choose Present or Absent for every listed student before saving.");
      return;
    }
    let status = "Absent";
    if (presentButton.checked) {
      status = "Present";
    }
    records.push({ matric: sheetMatrics[i], status: status });
  }

  const sessions = loadSessions();
  const existingIndex = findSessionIndex(sheetCourse, sheetDate);

  if (existingIndex !== -1) {
    const sure = confirm("A session for " + sheetCourse + " on " + sheetDate +
                         " already exists. Replace it with these changes?");
    if (!sure) {
      return;
    }
    sessions[existingIndex].records = records;
  } else {
    sessions.push({ courseCode: sheetCourse, date: sheetDate, records: records });
  }

  if (!saveSessions(sessions)) {
    return;
  }
  refreshAll();
  showAttendanceMessage("success", "Attendance saved for " + sheetCourse + " on " + sheetDate + ".");
}

// =====================================================
// PREVIOUS SESSIONS
// =====================================================
function renderSessionsTable() {
  const sessions = loadSessions();
  const box = document.getElementById("sessionsTable");

  if (sessions.length === 0) {
    box.innerHTML = `<p class="text-muted mb-0">No attendance sessions have been recorded yet.</p>`;
    return;
  }

  let rows = "";
  // Count backwards so the newest saved session appears first
  for (let i = sessions.length - 1; i >= 0; i--) {
    let presentCount = 0;
    const records = sessions[i].records;
    for (let j = 0; j < records.length; j++) {
      if (records[j].status === "Present") {
        presentCount++;
      }
    }

    let percent = null;
    if (records.length > 0) {
      percent = Math.round((presentCount / records.length) * 100);
    }

    rows += `<tr>
               <td>${escapeHtml(sessions[i].date)}</td>
               <td>${escapeHtml(sessions[i].courseCode)}</td>
               <td>${presentCount} / ${records.length}</td>
               <td style="min-width:160px;">${makeProgressBar(percent)}</td>
               <td><button type="button" class="btn btn-sm btn-outline-dark"
                           onclick="editSession(${i})">Edit</button></td>
             </tr>`;
  }

  box.innerHTML = `
    <div class="table-responsive">
      <table class="table table-striped align-middle">
        <thead class="table-dark"><tr><th>Date</th><th>Course</th><th>Present</th><th>Attendance</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// Load an old session into the attendance sheet so it can be corrected
function editSession(sessionIndex) {
  const sessions = loadSessions();
  courseSelect.value = sessions[sessionIndex].courseCode;
  dateInput.value = sessions[sessionIndex].date;
  loadAttendanceSheet();
  document.getElementById("attendanceSection").scrollIntoView();
}

// =====================================================
// REFRESH EVERYTHING ON THE PAGE
// =====================================================
function refreshAll() {
  populateFilters();
  renderDashboard();
  renderStudentTable();
  populateCourseSelect();
  renderSessionsTable();
}

// =====================================================
// EVENTS
// =====================================================
searchInput.addEventListener("input", renderStudentTable);
departmentFilter.addEventListener("change", renderStudentTable);
levelFilter.addEventListener("change", renderStudentTable);
courseFilter.addEventListener("change", renderStudentTable);

document.getElementById("loadSheetBtn").addEventListener("click", loadAttendanceSheet);

// If the course or date changes, the old sheet no longer matches, so clear it
courseSelect.addEventListener("change", clearAttendanceSheet);
dateInput.addEventListener("change", clearAttendanceSheet);

// Export every recorded attendance status as a spreadsheet-friendly CSV file.
function csvCell(value) {
  let text = String(value === null || value === undefined ? "" : value);
  // Prefix formula-like values so spreadsheet software treats them as text.
  if (/^[=+\-@\t\r]/.test(text)) {
    text = "'" + text;
  }
  return '"' + text.replaceAll('"', '""') + '"';
}

function exportAttendanceCsv() {
  const students = loadStudents();
  const sessions = loadSessions();
  if (sessions.length === 0) {
    showAttendanceMessage("warning", "There are no attendance sessions to export yet.");
    return;
  }

  const rows = [["Date", "Course Code", "Student Name", "Matriculation Number", "Department", "Level", "Status"]];
  for (let i = 0; i < sessions.length; i++) {
    for (let j = 0; j < sessions[i].records.length; j++) {
      const record = sessions[i].records[j];
      let student = null;
      for (let k = 0; k < students.length; k++) {
        if (students[k].matric === record.matric) {
          student = students[k];
          break;
        }
      }
      rows.push([
        sessions[i].date,
        sessions[i].courseCode,
        student ? student.name : "Student record not found",
        record.matric,
        student ? student.department : "",
        student ? student.level : "",
        record.status
      ]);
    }
  }

  const csvText = rows.map(function (row) {
    return row.map(csvCell).join(",");
  }).join("\r\n");
  const blob = new Blob(["\uFEFF" + csvText], { type: "text/csv;charset=utf-8;" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "attendance-report.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
  showAttendanceMessage("success", "Attendance CSV report exported.");
}

if (exportCsvButton !== null) {
  exportCsvButton.addEventListener("click", exportAttendanceCsv);
}

document.getElementById("sampleDataBtn").addEventListener("click", function () {
  const sure = confirm("Load sample data? This will REPLACE the students and attendance currently saved.");
  if (sure) {
    loadSampleData();
    clearAttendanceSheet();
    refreshAll();
  }
});

document.getElementById("resetDataBtn").addEventListener("click", function () {
  const sure = confirm("Delete ALL students and attendance records? This cannot be undone.");
  if (sure) {
    resetDemoData();
    clearAttendanceSheet();
    refreshAll();
  }
});

// ---------- START ----------
refreshAll();
console.log("lecturer.js loaded");

// main.js - code shared by every page: settings, storage, calculations, helpers

// =====================================================
// SETTINGS (easy to change)
// =====================================================
const APP_NAME = "Student Management System";

// Students below this attendance percentage are flagged as needing attention
const ATTENDANCE_THRESHOLD = 75;

// DEMO login details. These are NOT secret: anyone can read them in this file.
// Real systems keep passwords on a server, never in frontend code.
const DEMO_LECTURER_USERNAME = "lecturer";
const DEMO_LECTURER_PASSWORD = "demo123";

// Courses students can tick during registration
const AVAILABLE_COURSES = [
  { code: "CSC101", title: "Introduction to Computer Science" },
  { code: "CSC102", title: "Introduction to Programming" },
  { code: "CSC201", title: "Web Development Basics" },
  { code: "MTH101", title: "General Mathematics I" },
  { code: "GST101", title: "Use of English" }
];

console.log("main.js loaded: " + APP_NAME);

// =====================================================
// ROLE HELPERS (demonstration only, NOT real security)
// =====================================================
function setRole(role) {
  localStorage.setItem("currentRole", role);
}

function getRole() {
  return localStorage.getItem("currentRole");
}

function logout() {
  localStorage.removeItem("currentRole");
  localStorage.removeItem("currentStudent");
  window.location.href = "index.html";
}

// If the saved role is not the one this page needs, go back to the welcome page
function requireRole(requiredRole) {
  if (getRole() !== requiredRole) {
    window.location.href = "index.html";
  }
}

// =====================================================
// STORAGE: save and load students and attendance sessions
// =====================================================

// localStorage only stores TEXT, so we convert arrays to text with
// JSON.stringify (saving) and back to arrays with JSON.parse (loading).

function loadStudents() {
  const savedText = localStorage.getItem("students");
  if (savedText === null) {
    return [];   // nothing saved yet
  }
  try {
    return JSON.parse(savedText);
  } catch (error) {
    console.log("Could not read saved students: " + error);
    return [];
  }
}

function saveStudents(students) {
  try {
    localStorage.setItem("students", JSON.stringify(students));
    return true;
  } catch (error) {
    alert("The browser could not save the student records. Storage may be full or unavailable.");
    console.log("Could not save students: " + error);
    return false;
  }
}

function loadSessions() {
  const savedText = localStorage.getItem("sessions");
  if (savedText === null) {
    return [];
  }
  try {
    return JSON.parse(savedText);
  } catch (error) {
    console.log("Could not read saved sessions: " + error);
    return [];
  }
}

function saveSessions(sessions) {
  try {
    localStorage.setItem("sessions", JSON.stringify(sessions));
    return true;
  } catch (error) {
    alert("The browser could not save attendance. Storage may be full or unavailable.");
    console.log("Could not save sessions: " + error);
    return false;
  }
}

// =====================================================
// SMALL HELPERS
// =====================================================

// Make matric numbers consistent: remove spaces and use capital letters
function normalizeMatric(matric) {
  return matric.trim().toUpperCase();
}

// Find a student by matric number. Returns the position (index), or -1 if not found.
function findStudentIndex(matric) {
  const students = loadStudents();
  const wanted = normalizeMatric(matric);
  for (let i = 0; i < students.length; i++) {
    if (students[i].matric === wanted) {
      return i;
    }
  }
  return -1;
}

// Does this list of courses already contain this course code?
function courseExists(courseList, code) {
  for (let i = 0; i < courseList.length; i++) {
    if (courseList[i].code === code) {
      return true;
    }
  }
  return false;
}

// Does this student take this course?
function studentHasCourse(student, courseCode) {
  return courseExists(student.courses, courseCode);
}

// Every different course that at least one student has registered
function getCoursesInUse() {
  const students = loadStudents();
  const courses = [];
  for (let i = 0; i < students.length; i++) {
    for (let j = 0; j < students[i].courses.length; j++) {
      const course = students[i].courses[j];
      if (!courseExists(courses, course.code)) {
        courses.push({ code: course.code, title: course.title });
      }
    }
  }
  return courses;
}

// Stop typed text from being treated as HTML (a basic safety habit)
function escapeHtml(text) {
  let result = String(text);
  result = result.replaceAll("&", "&amp;");
  result = result.replaceAll("<", "&lt;");
  result = result.replaceAll(">", "&gt;");
  result = result.replaceAll('"', "&quot;");
  result = result.replaceAll("\'", "&#039;");
  return result;
}

// =====================================================
// ATTENDANCE CALCULATIONS
// =====================================================
// Percentage = (sessions attended / total sessions) x 100
// If there are no sessions, percent is null (so we never divide by zero).

function getCourseAttendance(matric, courseCode) {
  const sessions = loadSessions();
  let total = 0;
  let attended = 0;

  for (let i = 0; i < sessions.length; i++) {
    if (sessions[i].courseCode === courseCode) {
      for (let j = 0; j < sessions[i].records.length; j++) {
        if (sessions[i].records[j].matric === matric) {
          total++;
          if (sessions[i].records[j].status === "Present") {
            attended++;
          }
        }
      }
    }
  }

  let percent = null;
  if (total > 0) {
    percent = Math.round((attended / total) * 100);
  }
  return { total: total, attended: attended, percent: percent };
}

// Add up attendance across all of a student's registered courses
function getOverallAttendance(student) {
  let total = 0;
  let attended = 0;

  for (let i = 0; i < student.courses.length; i++) {
    const result = getCourseAttendance(student.matric, student.courses[i].code);
    total = total + result.total;
    attended = attended + result.attended;
  }

  let percent = null;
  if (total > 0) {
    percent = Math.round((attended / total) * 100);
  }
  return { total: total, attended: attended, percent: percent };
}

// Build the HTML for a Bootstrap progress bar (green if OK, red if below the threshold)
function makeProgressBar(percent) {
  if (percent === null) {
    return `<span class="text-muted small">No sessions recorded yet</span>`;
  }
  let colour = "bg-success";
  if (percent < ATTENDANCE_THRESHOLD) {
    colour = "bg-danger";
  }
  return `<div class="d-flex align-items-center gap-2">
            <div class="progress flex-grow-1" style="height: 14px;">
              <div class="progress-bar ${colour}" style="width: ${percent}%;"></div>
            </div>
            <span class="small fw-bold">${percent}%</span>
          </div>`;
}

// =====================================================
// SAMPLE DATA AND RESET (used by the lecturer portal)
// =====================================================

function loadSampleData() {
  const sampleStudents = [
    {
      name: "Amina Yusuf", matric: "CSC/2023/001", department: "Computer Science", level: "200",
      email: "amina@example.com",
      courses: [
        { code: "CSC201", title: "Web Development Basics" },
        { code: "CSC102", title: "Introduction to Programming" }
      ]
    },
    {
      name: "Chinedu Okafor", matric: "CSC/2023/002", department: "Computer Science", level: "200",
      email: "chinedu@example.com",
      courses: [
        { code: "CSC201", title: "Web Development Basics" },
        { code: "MTH101", title: "General Mathematics I" }
      ]
    },
    {
      name: "Fatima Bello", matric: "SEN/2023/010", department: "Software Engineering", level: "200",
      email: "fatima@example.com",
      courses: [
        { code: "CSC201", title: "Web Development Basics" },
        { code: "CSC102", title: "Introduction to Programming" }
      ]
    },
    {
      name: "David Adeyemi", matric: "CSC/2022/015", department: "Computer Science", level: "300",
      email: "",
      courses: [
        { code: "CSC201", title: "Web Development Basics" }
      ]
    },
    {
      name: "Grace Okoro", matric: "IFT/2023/020", department: "Information Technology", level: "100",
      email: "grace@example.com",
      courses: [
        { code: "CSC101", title: "Introduction to Computer Science" },
        { code: "CSC102", title: "Introduction to Programming" }
      ]
    }
  ];

  // These sessions are INVENTED demo data, not real classes
  const sampleSessions = [
    {
      courseCode: "CSC201", date: "2026-10-05",
      records: [
        { matric: "CSC/2023/001", status: "Present" },
        { matric: "CSC/2023/002", status: "Present" },
        { matric: "SEN/2023/010", status: "Present" },
        { matric: "CSC/2022/015", status: "Absent" }
      ]
    },
    {
      courseCode: "CSC201", date: "2026-10-12",
      records: [
        { matric: "CSC/2023/001", status: "Present" },
        { matric: "CSC/2023/002", status: "Absent" },
        { matric: "SEN/2023/010", status: "Present" },
        { matric: "CSC/2022/015", status: "Absent" }
      ]
    },
    {
      courseCode: "CSC201", date: "2026-10-19",
      records: [
        { matric: "CSC/2023/001", status: "Present" },
        { matric: "CSC/2023/002", status: "Absent" },
        { matric: "SEN/2023/010", status: "Present" },
        { matric: "CSC/2022/015", status: "Absent" }
      ]
    },
    {
      courseCode: "CSC102", date: "2026-10-07",
      records: [
        { matric: "CSC/2023/001", status: "Present" },
        { matric: "SEN/2023/010", status: "Present" },
        { matric: "IFT/2023/020", status: "Present" }
      ]
    },
    {
      courseCode: "CSC102", date: "2026-10-14",
      records: [
        { matric: "CSC/2023/001", status: "Absent" },
        { matric: "SEN/2023/010", status: "Present" },
        { matric: "IFT/2023/020", status: "Present" }
      ]
    }
  ];

  saveStudents(sampleStudents);
  saveSessions(sampleSessions);
}

// Delete all demo records (the caller must ask the user to confirm first)
function resetDemoData() {
  localStorage.removeItem("students");
  localStorage.removeItem("sessions");
  localStorage.removeItem("currentStudent");
}

// =====================================================
// LOGOUT BUTTON (exists only on portal pages)
// =====================================================
const logoutButton = document.getElementById("logoutBtn");

if (logoutButton !== null) {
  logoutButton.addEventListener("click", logout);
}

// =====================================================
// WELCOME PAGE CODE (exists only on index.html)
// =====================================================
const studentEnterButton = document.getElementById("studentEnterBtn");
const showLecturerLoginButton = document.getElementById("showLecturerLoginBtn");
const lecturerLoginForm = document.getElementById("lecturerLoginForm");

if (studentEnterButton !== null) {
  studentEnterButton.addEventListener("click", function () {
    setRole("student");
    window.location.href = "student.html";
  });
}

if (showLecturerLoginButton !== null) {
  showLecturerLoginButton.addEventListener("click", function () {
    lecturerLoginForm.classList.remove("d-none");
    showLecturerLoginButton.classList.add("d-none");
  });
}

if (lecturerLoginForm !== null) {
  lecturerLoginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const enteredUsername = document.getElementById("lecturerUsername").value.trim();
    const enteredPassword = document.getElementById("lecturerPassword").value;
    const messageBox = document.getElementById("loginMessage");

    if (enteredUsername === "" || enteredPassword === "") {
      messageBox.textContent = "Please enter both username and password.";
    } else if (enteredUsername === DEMO_LECTURER_USERNAME &&
               enteredPassword === DEMO_LECTURER_PASSWORD) {
      setRole("lecturer");
      window.location.href = "lecturer.html";
    } else {
      messageBox.textContent = "Incorrect username or password. Use the demo details above.";
    }
  });
}

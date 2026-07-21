/**
 * utils.js
 * Pure helper functions shared by home.js and result.js.
 */
const Utils = (() => {

  // Grades are always determined by PERCENTAGE, not raw marks. This matters
  // because subjects have different full marks (e.g. 80 for a theory paper
  // that has a separate 20-mark in-course component vs. 100 for a paper with
  // no in-course, like English or a full-mark elective). Grading 68/80 as if
  // it were 68/100 would unfairly punish an 80-mark subject.
  function percentageFor(marks, fullMarks = 100) {
    if (!fullMarks) return marks;
    return (marks / fullMarks) * 100;
  }

  function gradeFor(marks, fullMarks = 100) {
    const pct = percentageFor(marks, fullMarks);
    const scale = CONFIG.gradingScale;
    for (const row of scale) {
      if (pct >= row.min) return row;
    }
    return scale[scale.length - 1];
  }

  function isTheory(subject) {
    return (subject.type || "theory").toLowerCase() !== "practical";
  }

  // A subject with credit 0 (e.g. "English Compulsory") doesn't count toward
  // total marks, highest marks, or average marks — only credit-bearing
  // subjects should be summed. This mirrors how computeSgpa() already
  // ignores 0-credit subjects when awarding grade points.
  function isCredit(subject) {
    return (subject.credit || 0) > 0;
  }

  function isSgpaExam(examName) {
    const name = (examName || "").toLowerCase();
    return CONFIG.sgpaExamKeywords.some(k => name.includes(k));
  }

  // Compute SGPA for a single student using only theory subjects.
  function computeSgpa(exam, marksMap) {
    const theorySubjects = exam.subjects.filter(isTheory);
    if (theorySubjects.length === 0) return null;

    let totalPoints = 0;
    let totalCredits = 0;
    let hasFail = false;

    theorySubjects.forEach(sub => {
      const marks = marksMap[sub.code];
      if (marks === undefined || marks === null) return;
      const g = gradeFor(marks, sub.fullMarks || 100);
      if (g.grade === "F") hasFail = true;
      totalPoints += g.point * (sub.credit || 0);
      totalCredits += (sub.credit || 0);
    });

    if (totalCredits === 0) return null;
    const sgpa = totalPoints / totalCredits;
    return { sgpa, hasFail };
  }

  // Compute a full leaderboard for an exam: SGPA (test) or total marks (incourse) per student.
  function buildLeaderboard(exam) {
    const sgpaMode = isSgpaExam(exam.examName);
    const theorySubjects = exam.subjects.filter(isTheory);
    const creditSubjects = exam.subjects.filter(isCredit);
    const totalFullMarks = creditSubjects.reduce((sum, sub) => sum + (sub.fullMarks || 100), 0);

    const rows = exam.students.map(student => {
      const totalMarks = creditSubjects.reduce((sum, sub) => sum + (student.marks[sub.code] || 0), 0);
      let score;
      let sgpaResult = null;
      if (sgpaMode) {
        sgpaResult = computeSgpa(exam, student.marks);
        score = sgpaResult ? sgpaResult.sgpa : 0;
      } else {
        score = totalMarks;
      }
      return { student, score, sgpaResult, totalMarks };
    });

    rows.sort((a, b) => b.score - a.score || b.totalMarks - a.totalMarks);
    rows.forEach((row, i) => { row.rank = i + 1; });

    return { rows, sgpaMode, theorySubjects, totalFullMarks };
  }

  function average(nums) {
    if (!nums.length) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }

  function round(num, places = 2) {
    const f = Math.pow(10, places);
    return Math.round((num + Number.EPSILON) * f) / f;
  }

  function qs(sel, root = document) { return root.querySelector(sel); }
  function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  function el(tag, opts = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(opts).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k.startsWith("data-")) node.setAttribute(k, v);
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    });
    children.forEach(c => node.appendChild(c));
    return node;
  }

  function formatDate(d = new Date()) {
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  function debounce(fn, wait = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  return {
    gradeFor, percentageFor, isTheory, isSgpaExam, computeSgpa, buildLeaderboard,
    average, round, qs, qsa, el, formatDate, debounce
  };
})();

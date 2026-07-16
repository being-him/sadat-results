/**
 * home.js — homepage search form behaviour.
 */
(() => {
  const academicYearSel = Utils.qs("#academicYear");
  const examYearSel = Utils.qs("#examYear");
  const examSel = Utils.qs("#examSelect");
  const regInput = Utils.qs("#registration");
  const form = Utils.qs("#searchForm");
  const submitBtn = Utils.qs("#searchSubmit");
  const errorBox = Utils.qs("#formError");
  const searchOverlay = Utils.qs("#searchOverlay");
  const progressFill = searchOverlay.querySelector(".progress-fill");

  const SEARCH_PROGRESS_MS = 1200; // must match the progress-complete animation duration in style.css
  const OVERLAY_FADE_MS = 320; // must match --dur-med, used for the overlay's fade-scale-out animation

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function showOverlay() {
    searchOverlay.classList.remove("is-leaving");
    searchOverlay.hidden = false;
    // Restart the progress-fill animation from 0% every time the overlay opens.
    progressFill.classList.remove("is-filling");
    void progressFill.offsetWidth; // force reflow so the animation restarts
    progressFill.classList.add("is-filling");
  }

  function hideOverlay() {
    return new Promise(resolve => {
      searchOverlay.classList.add("is-leaving");
      setTimeout(() => {
        searchOverlay.hidden = true;
        searchOverlay.classList.remove("is-leaving");
        progressFill.classList.remove("is-filling");
        resolve();
      }, OVERLAY_FADE_MS);
    });
  }

  function setOptions(select, options, placeholder) {
    select.innerHTML = "";
    const ph = Utils.el("option", { value: "", disabled: "", selected: "" }, []);
    ph.textContent = placeholder;
    select.appendChild(ph);
    options.forEach(opt => {
      const o = Utils.el("option", { value: opt.value }, []);
      o.textContent = opt.label;
      select.appendChild(o);
    });
  }

  function resetSelect(select, placeholder) {
    setOptions(select, [], placeholder);
    select.disabled = true;
  }

  async function initAcademicYears() {
    setOptions(
      academicYearSel,
      CONFIG.academicYears.map(y => ({ value: y, label: y })),
      "Select academic year"
    );
  }

  async function onAcademicYearChange() {
    const year = academicYearSel.value;
    resetSelect(examYearSel, "Loading…");
    resetSelect(examSel, "Select exam year first");
    if (!year) return;

    try {
      const years = await Data.getExamYears(year);
      if (!years.length) {
        resetSelect(examYearSel, "No exam years found");
        return;
      }
      setOptions(examYearSel, years.map(y => ({ value: y, label: y })), "Select exam year");
      examYearSel.disabled = false;
    } catch (e) {
      resetSelect(examYearSel, "Could not load data");
      console.error(e);
    }
  }

  async function onExamYearChange() {
    const academicYear = academicYearSel.value;
    const examYear = examYearSel.value;
    resetSelect(examSel, "Loading…");
    if (!academicYear || !examYear) return;

    try {
      const exams = await Data.getExams(academicYear, examYear);
      if (!exams.length) {
        resetSelect(examSel, "No exams found");
        return;
      }
      setOptions(examSel, exams.map(ex => ({ value: ex.id, label: ex.examName })), "Select exam");
      examSel.disabled = false;
    } catch (e) {
      resetSelect(examSel, "Could not load data");
      console.error(e);
    }
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.animation = "none";
    // force reflow to restart the shake animation
    void errorBox.offsetWidth;
    errorBox.style.animation = "";
  }

  function clearError() {
    errorBox.textContent = "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    clearError();

    const academicYear = academicYearSel.value;
    const examYear = examYearSel.value;
    const examId = examSel.value;
    const registration = regInput.value.trim();

    if (!academicYear || !examYear || !examId) {
      showError("Please complete all selections before searching.");
      return;
    }
    if (!registration) {
      showError("Please enter your registration number.");
      regInput.focus();
      return;
    }

    submitBtn.classList.add("is-loading");
    submitBtn.disabled = true;
    showOverlay();

    try {
      const dataPromise = (async () => {
        const exams = await Data.getExams(academicYear, examYear);
        const exam = exams.find(e => e.id === examId);
        if (!exam) throw new Error("Exam not found");
        const examData = await Data.loadExamFile(examYear, exam.file);
        const student = Data.findStudent(examData, registration);
        return { exam, student };
      })();

      // Let the progress bar finish its fill animation and the data load
      // in parallel — whichever takes longer sets the pace, so the bar
      // always completes before we act on the result.
      const [{ exam, student }] = await Promise.all([dataPromise, wait(SEARCH_PROGRESS_MS)]);

      if (!student) {
        await hideOverlay();
        showError("No results found for this registration number. Please check and try again.");
        submitBtn.classList.remove("is-loading");
        submitBtn.disabled = false;
        return;
      }

      const params = new URLSearchParams({
        year: examYear,
        file: exam.file,
        reg: registration
      });

      await hideOverlay();
      document.querySelector(".app-shell").classList.add("page-transition-out");
      setTimeout(() => {
        window.location.href = `result.html?${params.toString()}`;
      }, 260);

    } catch (err) {
      console.error(err);
      await hideOverlay();
      showError("Something went wrong loading results. Please try again.");
      submitBtn.classList.remove("is-loading");
      submitBtn.disabled = false;
    }
  }

  academicYearSel.addEventListener("change", onAcademicYearChange);
  examYearSel.addEventListener("change", onExamYearChange);
  form.addEventListener("submit", handleSubmit);

  initAcademicYears();
})();

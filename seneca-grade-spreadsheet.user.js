// ==UserScript==
// @name         Seneca grade spreadsheet
// @namespace    https://seneca.juntadeandalucia.es/
// @version      1.3.0
// @description  Edit all criteria for all students using Seneca's existing save flow.
// @match        https://seneca.juntadeandalucia.es/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    const panelId = "seneca-grade-spreadsheet";
    const loadTimeoutMs = 30000;
    const state = {
        busy: false,
        loaded: false,
        criteria: [],
        originalStudentId: "",
        students: []
    };
    let autosaveQueue = Promise.resolve();
    let autosavesPending = 0;

    const style = document.createElement("style");
    style.textContent = `
        #${panelId} {
            position: fixed;
            z-index: 2147483000;
            inset: 4vh 4vw;
            display: none;
            overflow: auto;
            box-sizing: border-box;
            padding: 1rem;
            border: 1px solid #777;
            border-radius: 0.4rem;
            background: #fff;
            color: #212529;
            box-shadow: 0 0.5rem 2rem rgba(0, 0, 0, 0.35);
            font: 14px/1.4 Arial, sans-serif;
        }

        #${panelId}.senecaSpreadsheetVisible {
            display: block;
        }

        #${panelId} * {
            box-sizing: border-box;
        }

        #${panelId} .senecaSpreadsheetHeader,
        #${panelId} .senecaSpreadsheetActions {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 0.6rem;
            margin-bottom: 0.8rem;
        }

        #${panelId} .senecaSpreadsheetHeader {
            justify-content: space-between;
        }

        #${panelId} h2 {
            margin: 0;
            font-size: 1.25rem;
        }

        #${panelId} button,
        #${panelId} select,
        #${panelId} input {
            min-height: 2rem;
            padding: 0.25rem 0.5rem;
            font: inherit;
        }

        #${panelId} .senecaSpreadsheetStatus {
            min-height: 1.5rem;
            margin: 0.5rem 0;
        }

        #${panelId} .senecaSpreadsheetTableWrap {
            overflow: auto;
            max-height: calc(100% - 9rem);
            border: 1px solid #dee2e6;
        }

        #${panelId} table {
            width: 100%;
            border-collapse: collapse;
        }

        #${panelId} th,
        #${panelId} td {
            padding: 0.45rem 0.6rem;
            border-bottom: 1px solid #dee2e6;
            text-align: left;
        }

        #${panelId} th {
            position: sticky;
            top: 0;
            z-index: 1;
            background: #f1f3f5;
        }

        #${panelId} td:last-child {
            width: 10rem;
        }

        #${panelId} .senecaSpreadsheetCriterion {
            min-width: 6.25rem;
            text-align: center;
        }

        #${panelId} .senecaSpreadsheetGrade {
            width: 5.5rem;
            text-align: center;
        }

        #${panelId} .senecaSpreadsheetGrade.senecaSpreadsheetInvalid {
            border-color: #dc3545;
            outline: 1px solid #dc3545;
        }

        #${panelId} .senecaSpreadsheetValidation {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
        }

        #${panelId} .senecaSpreadsheetRowStatus {
            color: #555;
            white-space: nowrap;
        }
    `;
    document.head.append(style);

    const panel = document.createElement("section");
    panel.id = panelId;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", `${panelId}-title`);
    panel.innerHTML = `
        <div class="senecaSpreadsheetHeader">
            <h2 id="${panelId}-title">Notas por alumnado</h2>
            <button type="button" data-action="close" aria-label="Cerrar planilla">Cerrar</button>
        </div>
        <div class="senecaSpreadsheetActions">
            <button type="button" data-action="load">Cargar alumnado</button>
            <button type="button" data-action="save" disabled>Guardar cambios</button>
            <button type="button" data-action="copy" title="Copiar la nota de cada estudiante del primer criterio a sus demás criterios" disabled>Copiar 1.ª nota al resto</button>
            <label class="senecaSpreadsheetValidation">
                <input type="checkbox" data-role="allow-below-one">
                Esta clase permite valores menores de 1
            </label>
        </div>
        <p>La carga recorre el alumnado y guarda las notas actuales sin cambios mediante Seneca. Al salir de una casilla válida, sus cambios se guardan automáticamente.</p>
        <p class="senecaSpreadsheetStatus" data-role="status" aria-live="polite"></p>
        <div class="senecaSpreadsheetTableWrap" data-role="table"></div>
    `;
    document.body.append(panel);

    const status = panel.querySelector('[data-role="status"]');
    const tableContainer = panel.querySelector('[data-role="table"]');
    const loadButton = panel.querySelector('[data-action="load"]');
    const saveButton = panel.querySelector('[data-action="save"]');
    const copyButton = panel.querySelector('[data-action="copy"]');
    const allowBelowOneCheckbox = panel.querySelector('[data-role="allow-below-one"]');

    function formatSpanishScore(value) {
        if (value === "") {
            return "";
        }
        const number = Number(value);
        if (!Number.isFinite(number)) {
            return "";
        }
        return String(number).replace(".", ",");
    }

    function getModal() {
        return Array.from(document.querySelectorAll(".modal"))
            .find((modal) => modal.querySelector(".select-buscador"));
    }

    function getCriteria(modal) {
        return Array.from(modal.querySelectorAll("td.contenedorRubricas"))
            .map((cell, index) => {
                const input = cell.querySelector("input.notaCriterioModal");
                const label = cell.querySelector("label");
                if (!input || !label || !input.id) {
                    return null;
                }
                const fullLabel = label.textContent.trim();
                const codeMatch = fullLabel.match(/(?:^|[^\d])(\d+(?:\.\d+)+)(?=\s*\.?)/);
                return {
                    id: input.id,
                    label: fullLabel,
                    shortLabel: codeMatch ? codeMatch[1] : `Criterio ${index + 1}`
                };
            })
            .filter((criterion) => criterion !== null);
    }

    function setBusy(busy) {
        state.busy = busy;
        loadButton.disabled = busy || autosavesPending > 0;
        saveButton.disabled = busy || !state.loaded;
        copyButton.disabled = busy || !state.loaded || state.criteria.length < 2;
        allowBelowOneCheckbox.disabled = busy;
        panel.querySelector('[data-action="close"]').disabled = busy;
        panel.querySelectorAll(".senecaSpreadsheetGrade").forEach((input) => {
            input.disabled = busy;
        });
    }

    function parseGrade(text, allowBelowOne = allowBelowOneCheckbox.checked) {
        const normalized = text.trim().replace(",", ".");
        if (normalized === "") {
            return { valid: true, value: "" };
        }
        if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
            return { valid: false, value: "" };
        }

        const value = Number(normalized);
        return {
            valid: Number.isFinite(value)
                && value <= 10
                && value >= (allowBelowOne ? 0 : 1),
            value: String(value)
        };
    }

    function validationMessage() {
        return allowBelowOneCheckbox.checked
            ? "Introduce una nota entre 0 y 10; usa coma o punto decimal."
            : "Introduce una nota entre 1 y 10; para admitir valores inferiores a 1, marca la casilla de la clase.";
    }

    function validateGradeInput(input, report = false) {
        const parsed = parseGrade(input.value);
        input.setCustomValidity(parsed.valid ? "" : validationMessage());
        input.classList.toggle("senecaSpreadsheetInvalid", !parsed.valid);
        input.setAttribute("aria-invalid", String(!parsed.valid));
        if (!parsed.valid && report) {
            input.reportValidity();
        }
        return parsed;
    }

    function renderTable() {
        const table = document.createElement("table");
        const header = document.createElement("thead");
        const headerRow = document.createElement("tr");
        const studentHeading = document.createElement("th");
        studentHeading.textContent = "Alumnado";
        headerRow.append(studentHeading);
        state.criteria.forEach((criterion) => {
            const heading = document.createElement("th");
            heading.className = "senecaSpreadsheetCriterion";
            heading.textContent = criterion.shortLabel;
            heading.title = criterion.label;
            headerRow.append(heading);
        });
        const statusHeading = document.createElement("th");
        statusHeading.textContent = "Estado";
        headerRow.append(statusHeading);
        header.append(headerRow);

        const body = document.createElement("tbody");
        state.students.forEach((student, index) => {
            const row = document.createElement("tr");
            const nameCell = document.createElement("td");
            nameCell.textContent = student.name;
            row.append(nameCell);

            state.criteria.forEach((criterion) => {
                const gradeCell = document.createElement("td");
                gradeCell.className = "senecaSpreadsheetCriterion";
                const gradeInput = document.createElement("input");
                gradeInput.className = "senecaSpreadsheetGrade";
                gradeInput.type = "text";
                gradeInput.inputMode = "decimal";
                gradeInput.autocomplete = "off";
                gradeInput.setAttribute("aria-label", `Nota de ${student.name}, ${criterion.shortLabel}`);
                gradeInput.title = criterion.label;
                gradeInput.value = formatSpanishScore(student.grades[criterion.id]);
                gradeInput.dataset.studentIndex = String(index);
                gradeInput.dataset.criterionId = criterion.id;
                gradeInput.addEventListener("input", () => {
                    const parsed = validateGradeInput(gradeInput);
                    student.editedGrades[criterion.id] = parsed.valid ? parsed.value : null;
                    const hasInvalidGrade = Array.from(row.querySelectorAll(".senecaSpreadsheetGrade"))
                        .some((input) => !validateGradeInput(input).valid);
                    const hasPendingChange = state.criteria.some((entry) =>
                        student.editedGrades[entry.id] !== null
                        && student.editedGrades[entry.id] !== undefined
                        && student.editedGrades[entry.id] !== student.grades[entry.id]
                    );
                    row.querySelector(".senecaSpreadsheetRowStatus").textContent =
                        hasInvalidGrade ? "Nota no válida" : (hasPendingChange ? "Pendiente" : "");
                });
                gradeInput.addEventListener("blur", () => {
                    enqueueAutosave(student, row);
                });
                gradeCell.append(gradeInput);
                row.append(gradeCell);
            });

            const rowStatus = document.createElement("td");
            rowStatus.className = "senecaSpreadsheetRowStatus";
            row.append(rowStatus);
            body.append(row);
        });

        table.append(header, body);
        tableContainer.replaceChildren(table);
        saveButton.disabled = state.busy || !state.loaded;
        copyButton.disabled = state.busy || !state.loaded || state.criteria.length < 2;
    }

    function copyFirstCriterionToRest() {
        const firstCriterion = state.criteria[0];
        if (!firstCriterion || state.criteria.length < 2) {
            status.textContent = "Se necesitan al menos dos criterios para copiar notas.";
            return;
        }

        const rows = Array.from(panel.querySelectorAll("tbody tr"));
        const copies = [];
        for (const row of rows) {
            const inputs = Array.from(row.querySelectorAll(".senecaSpreadsheetGrade"));
            const sourceInput = inputs.find((input) => input.dataset.criterionId === firstCriterion.id);
            if (!sourceInput || sourceInput.value.trim() === "") {
                continue;
            }

            const parsed = validateGradeInput(sourceInput);
            if (!parsed.valid) {
                sourceInput.focus();
                status.textContent = "No se copiaron las notas: corrige primero la nota no válida de la primera columna.";
                return;
            }

            inputs.forEach((input) => {
                if (input.dataset.criterionId !== firstCriterion.id) {
                    copies.push({ input, value: parsed.value });
                }
            });
        }

        if (copies.length === 0) {
            status.textContent = "No hay notas válidas en la primera columna para copiar.";
            return;
        }

        copies.forEach(({ input, value }) => {
            input.value = formatSpanishScore(value);
            input.dispatchEvent(new Event("input", { bubbles: true }));
        });

        const copiedRows = new Set(copies.map(({ input }) => input.closest("tr")));
        copiedRows.forEach((row) => {
            const studentIndex = Number(row?.querySelector(".senecaSpreadsheetGrade")?.dataset.studentIndex);
            const student = state.students[studentIndex];
            if (student && row) {
                enqueueAutosave(student, row);
            }
        });
        status.textContent = `Copiadas las notas de ${copiedRows.size} estudiantes a los demás criterios; guardando automáticamente.`;
    }

    function getHiddenValue(modal, id) {
        const input = modal.querySelector(`#${id}`);
        return input instanceof HTMLInputElement ? input.value : "";
    }

    function getCurrentStudentId(modal) {
        return getHiddenValue(modal, "X_NOTACTEVA");
    }

    function getStudentList(modal) {
        const selector = modal.querySelector("select.select-buscador");
        if (!(selector instanceof HTMLSelectElement)) {
            throw new Error("No se encontró la lista de alumnado de Seneca.");
        }

        const students = Array.from(selector.options)
            .filter((option) => option.value !== "")
            .map((option) => ({ id: option.value, name: option.textContent.trim() }));
        if (students.length === 0) {
            throw new Error("La lista de alumnado está vacía.");
        }
        return students;
    }

    function getGradeInput(modal, criterionId) {
        const input = modal.querySelector(`#${CSS.escape(criterionId)}`);
        if (!(input instanceof HTMLInputElement) || input.type !== "number") {
            throw new Error("No se encontró una casilla de nota del criterio.");
        }
        return input;
    }

    function callSenecaLoad(targetStudentId, modal) {
        if (typeof window.alumnoSiguiente !== "function") {
            throw new Error("No se encontró la función de navegación y guardado de Seneca.");
        }

        const argumentIds = [
            "L_DIARIA",
            "F_ENTREGA",
            "L_FP",
            "L_LOMLOE",
            "X_GRUALUPROMAT",
            "X_CONVCENTRO",
            "X_ACTEVA"
        ];
        const values = argumentIds.map((id) => getHiddenValue(modal, id));
        if (values.some((value) => value === "")) {
            throw new Error("Faltan datos requeridos en la ventana de Seneca.");
        }

        window.alumnoSiguiente(
            "ACTUAL",
            values[0],
            values[1],
            values[2],
            values[3],
            values[4],
            values[5],
            values[6],
            targetStudentId
        );
    }

    function waitForStudent(targetStudentId, criteria, previousStudentId, previousInputs) {
        return new Promise((resolve, reject) => {
            let timeoutId;
            let intervalId;

            const finish = (error, result) => {
                observer.disconnect();
                window.clearTimeout(timeoutId);
                window.clearInterval(intervalId);
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            };

            const check = () => {
                const modal = getModal();
                if (!modal || getCurrentStudentId(modal) !== targetStudentId) {
                    return;
                }

                const gradeInputs = criteria.map((criterion) =>
                    modal.querySelector(`#${CSS.escape(criterion.id)}`)
                );
                if (gradeInputs.some((input) => !(input instanceof HTMLInputElement))) {
                    return;
                }

                if (targetStudentId !== previousStudentId
                    || gradeInputs.some((input, index) => input !== previousInputs[index])) {
                    finish(null, modal);
                    return;
                }

            };

            const observer = new MutationObserver(check);
            observer.observe(document.documentElement, { childList: true, subtree: true });
            intervalId = window.setInterval(check, 100);
            timeoutId = window.setTimeout(() => {
                finish(new Error(`Seneca no cargó al estudiante seleccionado en ${loadTimeoutMs / 1000} segundos.`));
            }, loadTimeoutMs);
            check();
        });
    }

    async function loadStudent(studentId) {
        const modal = getModal();
        if (!modal) {
            throw new Error("La ventana de calificación de Seneca ya no está disponible.");
        }

        const previousStudentId = getCurrentStudentId(modal);
        const previousInputs = state.criteria.map((criterion) =>
            modal.querySelector(`#${CSS.escape(criterion.id)}`)
        );
        callSenecaLoad(studentId, modal);
        return waitForStudent(studentId, state.criteria, previousStudentId, previousInputs);
    }

    async function loadAllStudents() {
        const modal = getModal();
        if (!modal) {
            throw new Error("Abre la ventana de calificación de Seneca antes de cargar la planilla.");
        }

        state.criteria = getCriteria(modal);
        if (state.criteria.length === 0) {
            throw new Error("No se encontraron criterios en la ventana actual.");
        }

        state.originalStudentId = getCurrentStudentId(modal);
        state.students = getStudentList(modal).map((student) => ({
            ...student,
            grades: {},
            editedGrades: Object.create(null),
            status: ""
        }));
        state.loaded = false;
        if (!state.originalStudentId) {
            throw new Error("No se pudo identificar al estudiante actual.");
        }
        if (!state.students.some((student) => student.id === state.originalStudentId)) {
            throw new Error("El estudiante actual no aparece en la lista desplegable.");
        }

        setBusy(true);
        tableContainer.replaceChildren();

        try {
            for (let index = 0; index < state.students.length; index += 1) {
                const student = state.students[index];
                status.textContent = `Cargando ${index + 1} de ${state.students.length}: ${student.name}`;

                let studentModal = getModal();
                if (!studentModal || getCurrentStudentId(studentModal) !== student.id) {
                    studentModal = await loadStudent(student.id);
                }

                const loadedCriteria = getCriteria(studentModal);
                if (loadedCriteria.length !== state.criteria.length
                    || state.criteria.some((criterion, criterionIndex) =>
                        loadedCriteria[criterionIndex]?.id !== criterion.id)) {
                    throw new Error(`La lista de criterios cambió al cargar a ${student.name}.`);
                }
                state.criteria.forEach((criterion) => {
                    const gradeInput = getGradeInput(studentModal, criterion.id);
                    const parsedGrade = parseGrade(gradeInput.value);
                    if (!parsedGrade.valid) {
                        throw new Error(
                            `La nota de ${criterion.shortLabel} para ${student.name} queda fuera del rango permitido. `
                            + (allowBelowOneCheckbox.checked
                                ? "El rango actual es de 0 a 10."
                                : "El rango actual es de 1 a 10; marca la casilla si esta clase permite notas inferiores a 1.")
                        );
                    }
                    student.grades[criterion.id] = parsedGrade.value;
                });
                student.status = "Cargada";
            }

            const currentModal = getModal();
            if (currentModal && getCurrentStudentId(currentModal) !== state.originalStudentId) {
                status.textContent = "Volviendo al estudiante inicial...";
                await loadStudent(state.originalStudentId);
            }

            renderTable();
            state.loaded = true;
            status.textContent = `Cargadas ${state.students.length} estudiantes y ${state.criteria.length} criterios.`;
        } catch (error) {
            status.textContent = `Carga detenida: ${error.message} Comprueba en Seneca qué estudiante está abierto antes de continuar.`;
            throw error;
        } finally {
            setBusy(false);
        }
    }

    function getPendingGrades(student) {
        const pendingGrades = Object.create(null);
        state.criteria.forEach((criterion) => {
            const grade = student.editedGrades[criterion.id];
            if (grade !== null && grade !== undefined && grade !== student.grades[criterion.id]) {
                pendingGrades[criterion.id] = grade;
            }
        });
        return pendingGrades;
    }

    function getStudentRow(student) {
        const studentIndex = state.students.indexOf(student);
        return studentIndex < 0
            ? null
            : panel.querySelectorAll("tbody tr")[studentIndex] || null;
    }

    function setStudentRowStatus(student, message) {
        const row = getStudentRow(student);
        const rowStatus = row?.querySelector(".senecaSpreadsheetRowStatus");
        if (rowStatus) {
            rowStatus.textContent = message;
        }
    }

    function validateStudentRow(student, row, report = false) {
        let firstInvalid = null;
        row.querySelectorAll(".senecaSpreadsheetGrade").forEach((input) => {
            const parsed = validateGradeInput(input);
            student.editedGrades[input.dataset.criterionId] = parsed.valid
                && parsed.value !== student.grades[input.dataset.criterionId]
                ? parsed.value
                : null;
            if (!parsed.valid && !firstInvalid) {
                firstInvalid = input;
            }
        });

        if (firstInvalid && report) {
            firstInvalid.focus();
            firstInvalid.reportValidity();
        }
        return firstInvalid === null;
    }

    function validateAllGrades(report = false) {
        const gradeInputs = Array.from(panel.querySelectorAll(".senecaSpreadsheetGrade"));
        const invalidInputs = gradeInputs.filter((input) => !validateGradeInput(input).valid);
        if (report && invalidInputs.length > 0) {
            invalidInputs[0].focus();
            invalidInputs[0].reportValidity();
        }
        return invalidInputs.length === 0;
    }

    function markSnapshotSaved(student, snapshot) {
        state.criteria.forEach((criterion) => {
            if (!Object.hasOwn(snapshot, criterion.id)) {
                return;
            }

            const savedGrade = snapshot[criterion.id];
            student.grades[criterion.id] = savedGrade;
            const currentInput = getStudentRow(student)?.querySelector(
                `.senecaSpreadsheetGrade[data-criterion-id="${CSS.escape(criterion.id)}"]`
            );
            const currentGrade = currentInput ? validateGradeInput(currentInput).value : undefined;
            if (currentGrade === savedGrade) {
                student.editedGrades[criterion.id] = null;
            }
        });

        const pendingGrades = getPendingGrades(student);
        setStudentRowStatus(student, Object.keys(pendingGrades).length > 0 ? "Pendiente" : "Guardada");
    }

    function applyStudentGrades(student, snapshot) {
        const modal = getModal();
        if (!modal || getCurrentStudentId(modal) !== student.id) {
            throw new Error(`No está abierto el estudiante ${student.name}.`);
        }

        state.criteria.forEach((criterion) => {
            const editedGrade = snapshot[criterion.id];
            if (editedGrade === undefined) {
                return;
            }

            const gradeInput = getGradeInput(modal, criterion.id);
            gradeInput.value = editedGrade;
            gradeInput.dispatchEvent(new Event("input", { bubbles: true }));
            gradeInput.dispatchEvent(new Event("change", { bubbles: true }));
        });
    }

    async function saveStudentSnapshot(student, snapshot) {
        if (Object.keys(snapshot).length === 0) {
            return;
        }

        let modal = getModal();
        if (!modal) {
            throw new Error("La ventana de calificación de Séneca ya no está disponible.");
        }
        if (getCurrentStudentId(modal) !== student.id) {
            modal = await loadStudent(student.id);
        }

        applyStudentGrades(student, snapshot);
        await loadStudent(student.id);
        markSnapshotSaved(student, snapshot);
    }

    function enqueueAutosave(student, row) {
        if (state.busy || !state.loaded || !validateStudentRow(student, row)) {
            if (state.loaded && !state.busy) {
                setStudentRowStatus(student, "Autoguardado bloqueado: corrige las notas no válidas.");
                status.textContent = `No se guardó a ${student.name}: corrige las notas marcadas en rojo.`;
            }
            return;
        }

        const snapshot = getPendingGrades(student);
        if (Object.keys(snapshot).length === 0) {
            return;
        }

        autosavesPending += 1;
        setStudentRowStatus(student, "Autoguardado pendiente…");
        autosaveQueue = autosaveQueue.then(async () => {
            try {
                if (Object.values(snapshot).some((grade) => !parseGrade(grade).valid)) {
                    setStudentRowStatus(student, "No válida: revisa el límite de la clase.");
                    status.textContent = `No se autoguardó a ${student.name}: la nota dejó de ser válida con el límite actual.`;
                    return;
                }

                setStudentRowStatus(student, "Autoguardando…");
                status.textContent = `Autoguardando cambios de ${student.name}…`;
                await saveStudentSnapshot(student, snapshot);
                status.textContent = `Cambios de ${student.name} guardados automáticamente.`;
            } catch (error) {
                setStudentRowStatus(student, "Error al autoguardar");
                status.textContent = `No se pudieron autoguardar los cambios de ${student.name}: ${error.message} Pulsa «Guardar cambios» para reintentarlo.`;
                console.error("[Seneca grade spreadsheet] Autosave failed", error);
            } finally {
                autosavesPending -= 1;
                allowBelowOneCheckbox.disabled = state.busy;
                loadButton.disabled = state.busy || autosavesPending > 0;
            }
        });
    }

    async function saveChanges() {
        if (!validateAllGrades(true)) {
            status.textContent = "No se guardó ningún cambio: corrige primero las notas marcadas en rojo.";
            return;
        }

        setBusy(true);
        try {
            await autosaveQueue;

            if (!validateAllGrades(true)) {
                status.textContent = "No se guardó ningún cambio: corrige primero las notas marcadas en rojo.";
                return;
            }

            const changedStudents = state.students.filter((student) => state.criteria.some((criterion) =>
                student.editedGrades[criterion.id] !== null
                && student.editedGrades[criterion.id] !== undefined
                && student.editedGrades[criterion.id] !== student.grades[criterion.id]
            ));
            if (changedStudents.length === 0) {
                status.textContent = "No hay cambios para guardar.";
                return;
            }

            for (let index = 0; index < changedStudents.length; index += 1) {
                const student = changedStudents[index];
                const modal = getModal();

                if (!modal || getCurrentStudentId(modal) !== student.id) {
                    status.textContent = `Preparando ${index + 1} de ${changedStudents.length}: ${student.name}`;
                    await loadStudent(student.id);
                }

                const snapshot = getPendingGrades(student);
                applyStudentGrades(student, snapshot);
                setStudentRowStatus(student, "Guardando…");
                status.textContent = `Guardando ${index + 1} de ${changedStudents.length}: ${student.name}`;

                const nextChangedStudentId = index + 1 < changedStudents.length
                    ? changedStudents[index + 1].id
                    : null;
                const saveTargetId = nextChangedStudentId
                    || (state.originalStudentId !== student.id
                        ? state.originalStudentId
                        : state.students.find((entry) => entry.id !== student.id)?.id)
                    || student.id;
                await loadStudent(saveTargetId);

                markSnapshotSaved(student, snapshot);
            }

            const currentModal = getModal();
            if (currentModal && getCurrentStudentId(currentModal) !== state.originalStudentId) {
                status.textContent = "Volviendo al estudiante inicial...";
                await loadStudent(state.originalStudentId);
            }

            status.textContent = `Guardadas las notas de ${changedStudents.length} estudiantes.`;
        } catch (error) {
            status.textContent = `Guardado detenido: ${error.message} Revisa las notas en Seneca antes de volver a intentarlo.`;
            throw error;
        } finally {
            setBusy(false);
        }
    }

    allowBelowOneCheckbox.addEventListener("change", () => {
        if (!state.loaded) {
            status.textContent = allowBelowOneCheckbox.checked
                ? "Se permiten notas desde 0 hasta 10 en esta clase."
                : "Se permiten notas desde 1 hasta 10 en esta clase.";
            return;
        }

        state.students.forEach((student) => {
            const row = getStudentRow(student);
            if (!row) {
                return;
            }

            const isValid = validateStudentRow(student, row);
            const pending = getPendingGrades(student);
            setStudentRowStatus(
                student,
                !isValid
                    ? "Nota no válida"
                    : Object.keys(pending).length > 0 ? "Pendiente" : ""
            );
            if (isValid && Object.keys(pending).length > 0) {
                enqueueAutosave(student, row);
            }
        });
        status.textContent = allowBelowOneCheckbox.checked
            ? "Validación actualizada: se permiten notas desde 0 hasta 10."
            : "Validación actualizada: se permiten notas desde 1 hasta 10.";
    });

    panel.addEventListener("click", (event) => {
        const button = event.target instanceof Element
            ? event.target.closest("button[data-action]")
            : null;
        if (!button) {
            return;
        }

        if (button.dataset.action === "close") {
            panel.classList.remove("senecaSpreadsheetVisible");
        } else if (button.dataset.action === "load") {
            loadAllStudents().catch((error) => {
                if (!status.textContent.includes(error.message)) {
                    status.textContent = error.message;
                }
                console.error("[Seneca grade spreadsheet]", error);
            });
        } else if (button.dataset.action === "save") {
            saveChanges().catch((error) => {
                if (!status.textContent.includes(error.message)) {
                    status.textContent = error.message;
                }
                console.error("[Seneca grade spreadsheet]", error);
            });
        } else if (button.dataset.action === "copy") {
            copyFirstCriterionToRest();
        }
    });

    function addOpenButton() {
        if (!panel.isConnected && document.body) {
            document.body.append(panel);
        }
        const modal = getModal();
        if (!modal) {
            return;
        }

        const toolbar = modal.querySelector(".modalToolbar");
        if (!toolbar || toolbar.querySelector(".senecaSpreadsheetOpen")) {
            return;
        }

        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-sm btn-primary senecaSpreadsheetOpen";
        button.textContent = "Planilla";
        button.addEventListener("click", () => {
            panel.remove();
            modal.append(panel);
            panel.classList.add("senecaSpreadsheetVisible");
            status.textContent = "Carga el alumnado para ver todos los criterios en columnas.";
        });
        toolbar.append(button);
    }

    addOpenButton();
    const observer = new MutationObserver(addOpenButton);
    observer.observe(document.documentElement, { childList: true, subtree: true });
})();

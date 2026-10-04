// ==UserScript==
// @name         Seneca quarter-point grade scale hidden choice
// @namespace    https://seneca.juntadeandalucia.es/
// @version      1.2.1
// @description  Adds a clickable quarter-point scale to Seneca rubric panels.
// @match        https://seneca.juntadeandalucia.es/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    const minimum = 1;
    const maximum = 10;
    const increment = 0.25;
    const numberOfIntervals = (maximum - minimum) / increment;

    const style = document.createElement("style");
    style.textContent = `
        table.senecaQuarterTable {
            width: 100% !important;
            table-layout: fixed;
        }

        td.senecaQuarterCell {
            width: 100% !important;
        }

        .senecaQuarterChoice {
            display: block !important;
            box-sizing: border-box;
            width: 100% !important;
            max-width: none !important;
            padding: 0.75rem 0.25rem;
        }

        .wrapperRespuestas.senecaQuarterOnly > .itemRespuesta:not(.senecaQuarterChoice) {
            display: none !important;
        }

        .senecaQuarterScale {
            display: block !important;
            box-sizing: border-box;
            width: 100% !important;
            max-width: none !important;
            padding: 0.25rem 0.5rem 0.75rem;
            user-select: none;
        }

        .senecaQuarterScaleHeader {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 0.75rem;
        }

        .senecaQuarterScaleValue {
            font-weight: bold;
        }

        .senecaQuarterTrack {
            position: relative;
            display: block;
            box-sizing: border-box;
            width: calc(100% - 0.9rem);
            height: 2rem;
            margin: 0 0.45rem;
            cursor: pointer;
            touch-action: none;
        }

        .senecaQuarterTooltip {
            position: fixed;
            z-index: 2147483647;
            display: none;
            width: max-content;
            max-width: min(20rem, calc(100vw - 1rem));
            max-height: 30vh;
            overflow: auto;
            padding: 0.35rem 0.5rem;
            border: 1px solid #777;
            border-radius: 0.25rem;
            background: #fff;
            color: #212529;
            box-shadow: 0 0.2rem 0.6rem rgba(0, 0, 0, 0.2);
            white-space: normal;
            overflow-wrap: anywhere;
            font-size: 0.78rem;
            line-height: 1.25;
            pointer-events: none;
        }

        .senecaQuarterTooltip strong {
            display: block;
            margin-bottom: 0.15rem;
        }

        .senecaQuarterTrack:focus-visible {
            outline: 2px solid #007bff;
            outline-offset: 4px;
        }

        .senecaQuarterTrackLine {
            position: absolute;
            top: 50%;
            right: 0;
            left: 0;
            height: 2px;
            background: #777;
            transform: translateY(-50%);
        }

        .senecaQuarterTick {
            position: absolute;
            top: 50%;
            width: 1px;
            height: 7px;
            background: #777;
            transform: translate(-50%, -50%);
            pointer-events: none;
        }

        .senecaQuarterTickMajor {
            width: 2px;
            height: 13px;
            background: #333;
        }

        .senecaQuarterThumb {
            position: absolute;
            top: 50%;
            width: 14px;
            height: 14px;
            border: 2px solid #fff;
            border-radius: 50%;
            background: #007bff;
            box-shadow: 0 0 0 1px #0056b3;
            transform: translate(-50%, -50%);
            pointer-events: none;
        }

        .senecaQuarterEndpoint {
            display: flex;
            justify-content: space-between;
            margin: 0 0.45rem;
            color: #555;
            font-size: 0.8rem;
        }
    `;
    document.head.append(style);

    function formatSpanishScore(score) {
        return Number.isInteger(score)
            ? String(score)
            : score.toFixed(2).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",");
    }

    function getRubricRange(radio) {
        const label = radio.dataset.c_nivlomloe || "";
        const match = label.match(/^\s*(\d+(?:,\d+)?)\s*-\s*(\d+(?:,\d+)?)\s*$/);
        if (!match) {
            return null;
        }

        return {
            label,
            minimum: Number(match[1].replace(",", ".")),
            maximum: Number(match[2].replace(",", "."))
        };
    }

    function addQuarterScales() {
        document.querySelectorAll(".wrapperRespuestas").forEach((wrapper) => {
            if (wrapper.dataset.senecaQuarterScaleAdded === "true") {
                return;
            }

            const referenceRadio = wrapper.querySelector("input.radioRubrica[data-idnota]");
            if (!referenceRadio) {
                return;
            }

            const rubricDescriptions = Array.from(wrapper.querySelectorAll(".itemRespuesta"))
                .map((item) => {
                    const radio = item.querySelector("input.radioRubrica");
                    const description = item.querySelector("p");
                    const range = radio ? getRubricRange(radio) : null;
                    if (!range || !description) {
                        return null;
                    }

                    return {
                        ...range,
                        text: description.textContent.trim()
                    };
                })
                .filter((entry) => entry !== null && entry.text !== "");

            const gradeInput = document.getElementById(referenceRadio.dataset.idnota);
            if (!(gradeInput instanceof HTMLInputElement) || gradeInput.type !== "number") {
                return;
            }

            const row = document.createElement("div");
            row.className = "itemRespuesta senecaQuarterChoice";

            const scale = document.createElement("div");
            scale.className = "senecaQuarterScale";

            const header = document.createElement("div");
            header.className = "senecaQuarterScaleHeader";

            const title = document.createElement("span");
            title.textContent = "Nota exacta";

            const valueLabel = document.createElement("strong");
            valueLabel.className = "senecaQuarterScaleValue";
            valueLabel.textContent = "Selecciona una nota";
            header.append(title, valueLabel);

            const track = document.createElement("div");
            track.className = "senecaQuarterTrack";
            track.setAttribute("role", "slider");
            track.setAttribute("tabindex", "0");
            track.setAttribute("aria-label", "Nota exacta");
            track.setAttribute("aria-valuemin", String(minimum));
            track.setAttribute("aria-valuemax", String(maximum));
            track.setAttribute("aria-valuetext", "Sin seleccionar");

            const tooltip = document.createElement("div");
            tooltip.className = "senecaQuarterTooltip";
            tooltip.id = `seneca-quarter-tooltip-${gradeInput.id}`;
            tooltip.setAttribute("role", "tooltip");
            track.setAttribute("aria-describedby", tooltip.id);
            const tooltipRange = document.createElement("strong");
            const tooltipDescription = document.createElement("span");
            tooltip.append(tooltipRange, tooltipDescription);
            document.body.append(tooltip);

            const trackLine = document.createElement("div");
            trackLine.className = "senecaQuarterTrackLine";
            track.append(trackLine);

            for (let index = 0; index <= numberOfIntervals; index += 1) {
                const tick = document.createElement("span");
                tick.className = index % 4 === 0
                    ? "senecaQuarterTick senecaQuarterTickMajor"
                    : "senecaQuarterTick";
                tick.style.left = `${(index / numberOfIntervals) * 100}%`;
                const score = minimum + index * increment;
                const description = rubricDescriptions.find((entry) =>
                    score >= entry.minimum && score <= entry.maximum
                );
                if (description) {
                    tick.setAttribute(
                        "aria-label",
                        `${formatSpanishScore(score)}: ${description.label}. ${description.text}`
                    );
                }
                track.append(tick);
            }

            const thumb = document.createElement("span");
            thumb.className = "senecaQuarterThumb";
            thumb.hidden = true;
            track.append(thumb);

            const endpoints = document.createElement("div");
            endpoints.className = "senecaQuarterEndpoint";
            const startLabel = document.createElement("span");
            startLabel.textContent = formatSpanishScore(minimum);
            const endLabel = document.createElement("span");
            endLabel.textContent = formatSpanishScore(maximum);
            endpoints.append(startLabel, endLabel);

            scale.append(header, track, endpoints);
            row.append(scale);
            wrapper.append(row);
            wrapper.classList.add("senecaQuarterOnly");
            wrapper.closest("table")?.classList.add("senecaQuarterTable");
            wrapper.closest("td")?.classList.add("senecaQuarterCell");

            let selectedIndex = null;
            let pointerInsideTrack = false;
            let dragging = false;

            function getDescription(score) {
                return rubricDescriptions.find((entry) =>
                    score >= entry.minimum && score <= entry.maximum
                );
            }

            function showTooltip(index, clientX) {
                const score = minimum + index * increment;
                const description = getDescription(score);
                tooltipRange.textContent = description
                    ? `${description.label} — ${formatSpanishScore(score)}`
                    : formatSpanishScore(score);
                tooltipDescription.textContent = description?.text || "";
                tooltip.style.display = "block";

                const bounds = track.getBoundingClientRect();
                const tooltipBounds = tooltip.getBoundingClientRect();
                const margin = 8;
                const left = Math.max(
                    margin,
                    Math.min(
                        clientX - tooltipBounds.width / 2,
                        window.innerWidth - tooltipBounds.width - margin
                    )
                );
                const above = bounds.top - tooltipBounds.height - margin;
                const top = above >= margin
                    ? above
                    : Math.min(bounds.bottom + margin, window.innerHeight - tooltipBounds.height - margin);
                tooltip.style.left = `${left}px`;
                tooltip.style.top = `${Math.max(margin, top)}px`;

                if (description) {
                    track.setAttribute(
                        "aria-valuetext",
                        `${formatSpanishScore(score)}. ${description.label}. ${description.text}`
                    );
                }
            }

            function selectIndex(index) {
                selectedIndex = Math.max(0, Math.min(numberOfIntervals, index));
                const score = minimum + selectedIndex * increment;
                const formattedScore = formatSpanishScore(score);

                gradeInput.step = String(increment);
                gradeInput.value = score.toFixed(2).replace(/\.00$/, "");
                gradeInput.dispatchEvent(new Event("input", { bubbles: true }));
                gradeInput.dispatchEvent(new Event("change", { bubbles: true }));

                wrapper.querySelectorAll("input.radioRubrica").forEach((rubricRadio) => {
                    rubricRadio.checked = false;
                });

                valueLabel.textContent = formattedScore;
                track.setAttribute("aria-valuenow", String(score));
                track.setAttribute("aria-valuetext", formattedScore);
                thumb.style.left = `${(selectedIndex / numberOfIntervals) * 100}%`;
                thumb.hidden = false;
            }

            function selectFromPointer(event) {
                const bounds = track.getBoundingClientRect();
                if (bounds.width === 0) {
                    return;
                }

                pointerInsideTrack = event.clientX >= bounds.left
                    && event.clientX <= bounds.right
                    && event.clientY >= bounds.top
                    && event.clientY <= bounds.bottom;
                const position = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
                const index = Math.round(position * numberOfIntervals);
                showTooltip(index, event.clientX);
                return index;
            }

            track.addEventListener("pointerdown", (event) => {
                dragging = true;
                track.setPointerCapture(event.pointerId);
                const index = selectFromPointer(event);
                if (index !== undefined) {
                    selectIndex(index);
                }
            });
            track.addEventListener("pointermove", (event) => {
                const index = selectFromPointer(event);
                if (track.hasPointerCapture(event.pointerId)) {
                    if (index !== undefined) {
                        selectIndex(index);
                    }
                }
            });
            track.addEventListener("pointerleave", () => {
                pointerInsideTrack = false;
                if (!dragging) {
                    tooltip.style.display = "none";
                }
            });
            track.addEventListener("pointerup", (event) => {
                dragging = false;
                if (track.hasPointerCapture(event.pointerId)) {
                    track.releasePointerCapture(event.pointerId);
                }
                if (!pointerInsideTrack) {
                    tooltip.style.display = "none";
                }
            });
            track.addEventListener("pointercancel", () => {
                dragging = false;
                tooltip.style.display = "none";
            });
            track.addEventListener("focus", () => {
                if (selectedIndex !== null) {
                    const bounds = track.getBoundingClientRect();
                    const clientX = bounds.left + (selectedIndex / numberOfIntervals) * bounds.width;
                    showTooltip(selectedIndex, clientX);
                } else {
                    showTooltip(0, track.getBoundingClientRect().left);
                }
            });
            track.addEventListener("blur", () => {
                if (!pointerInsideTrack) {
                    tooltip.style.display = "none";
                }
            });
            track.addEventListener("keydown", (event) => {
                let nextIndex = selectedIndex ?? 0;
                if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                    nextIndex += 1;
                } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                    nextIndex -= 1;
                } else if (event.key === "Home") {
                    nextIndex = 0;
                } else if (event.key === "End") {
                    nextIndex = numberOfIntervals;
                } else {
                    return;
                }

                event.preventDefault();
                selectIndex(nextIndex);
                const bounds = track.getBoundingClientRect();
                const clientX = bounds.left + (selectedIndex / numberOfIntervals) * bounds.width;
                showTooltip(selectedIndex, clientX);
            });

            wrapper.dataset.senecaQuarterScaleAdded = "true";
        });
    }

    addQuarterScales();

    const observer = new MutationObserver(addQuarterScales);
    observer.observe(document.documentElement, { childList: true, subtree: true });

    window.addEventListener("pageshow", addQuarterScales);
    window.addEventListener("popstate", addQuarterScales);
    window.addEventListener("hashchange", addQuarterScales);
})();


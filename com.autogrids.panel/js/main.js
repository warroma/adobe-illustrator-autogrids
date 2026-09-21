var csInterface = new CSInterface();

var PT_PER_MM = 2.8346456693;
var PT_PER_IN = 72;

function ptToUnit(pt, unit) {
    if (unit === "mm") return pt / PT_PER_MM;
    if (unit === "in") return pt / PT_PER_IN;
    return pt;
}
function unitToPt(val, unit) {
    if (unit === "mm") return val * PT_PER_MM;
    if (unit === "in") return val * PT_PER_IN;
    return val;
}
function fmt(n) {
    return (Math.round(n * 100) / 100).toString();
}

var DOT_TYPES = { "four-dots": true, "three-dots": true };

var state = {
    section: "guias",
    type: "rectangle",
    unit: "mm",
    cellSizePt: unitToPt(20, "mm"),
    marginPt: 0,
    dotSizePt: unitToPt(1.5, "mm"),
    intensity: 60,
    liquidStrength: 50,
    liquidTag: null,
    liquidShapes: null
};

var els = {
    sectionTabs: document.getElementById("sectionTabs"),
    typeGridGuias: document.getElementById("typeGrid-guias"),
    typeGridPontos: document.getElementById("typeGrid-pontos"),
    unitToggle: document.getElementById("unitToggle"),
    cellSize: document.getElementById("cellSize"),
    cellSizeVal: document.getElementById("cellSizeVal"),
    margin: document.getElementById("margin"),
    marginVal: document.getElementById("marginVal"),
    dotFields: document.getElementById("dotFields"),
    dotSize: document.getElementById("dotSize"),
    dotSizeVal: document.getElementById("dotSizeVal"),
    intensity: document.getElementById("intensity"),
    intensityVal: document.getElementById("intensityVal"),
    unitLabels: [document.getElementById("unitLabel1"), document.getElementById("unitLabel2"), document.getElementById("unitLabel3")],
    cellSizeField: document.getElementById("cellSizeField"),
    marginField: document.getElementById("marginField"),
    liquidFields: document.getElementById("liquidFields"),
    liquidStatus: document.getElementById("liquidStatus"),
    captureBtn: document.getElementById("captureBtn"),
    liquidStrength: document.getElementById("liquidStrength"),
    liquidStrengthVal: document.getElementById("liquidStrengthVal"),
    clearBtn: document.getElementById("clearBtn"),
    status: document.getElementById("status")
};

function syncReadouts() {
    els.cellSize.value = state.cellSizePt;
    els.cellSizeVal.value = fmt(ptToUnit(state.cellSizePt, state.unit));
    els.margin.value = state.marginPt;
    els.marginVal.value = fmt(ptToUnit(state.marginPt, state.unit));
    els.dotSize.value = state.dotSizePt;
    els.dotSizeVal.value = fmt(ptToUnit(state.dotSizePt, state.unit));
    els.intensity.value = state.intensity;
    els.intensityVal.textContent = state.intensity + "%";
    els.unitLabels.forEach(function (el) { el.textContent = state.unit; });
    els.liquidStrength.value = state.liquidStrength;
    els.liquidStrengthVal.textContent = state.liquidStrength + "%";

    var isPontos = state.section === "pontos";
    var isLiquido = state.section === "liquido";

    els.dotFields.style.display = isPontos ? "block" : "none";
    els.liquidFields.style.display = isLiquido ? "block" : "none";
    els.typeGridGuias.style.display = (!isPontos && !isLiquido) ? "grid" : "none";
    els.typeGridPontos.style.display = isPontos ? "grid" : "none";
    els.unitToggle.style.display = isLiquido ? "none" : "flex";
    els.cellSizeField.style.display = isLiquido ? "none" : "block";
    els.marginField.style.display = isLiquido ? "none" : "block";
    els.clearBtn.textContent = isLiquido ? "Limpar conexões líquidas" : "Limpar prancheta";
}

function updateLiquidStatus(msg, kind) {
    if (msg) {
        els.liquidStatus.textContent = msg;
    } else if (state.liquidShapes) {
        els.liquidStatus.textContent = "Conexão capturada — ajuste a pregnância ou capture outro par.";
        kind = "ok";
    } else {
        els.liquidStatus.textContent = "Selecione 2 formas (círculo, elipse ou retângulo) no artboard e clique em \"Capturar seleção\".";
    }
    els.liquidStatus.className = "liquid-status" + (kind ? " " + kind : "");
}

function setStatus(msg, isError) {
    els.status.textContent = msg;
    els.status.className = isError ? "error" : "";
}

// Preview ao vivo: toda mudança reaplica automaticamente (com debounce) na
// prancheta ativa NO MOMENTO da chamada. Isso é seguro mesmo trocando de
// prancheta no meio do ajuste porque o host.jsx marca cada objeto com a
// prancheta que o criou e só limpa/redesenha essa marca — nunca mexe em
// outra prancheta (ver AutoGrids_apply em host.jsx).
var debounceTimer = null;
function requestApply() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(doApply, 90);
}

function doApply() {
    var call = "AutoGrids_apply(" +
        '"' + state.type + '",' +
        state.cellSizePt + "," +
        state.marginPt + "," +
        state.dotSizePt + "," +
        state.intensity + "," +
        state.intensity +
        ")";
    csInterface.evalScript(call, function (result) {
        if (result && result.indexOf("ERRO") === 0) {
            setStatus(result, true);
        } else {
            setStatus("Grade atualizada.", false);
        }
    });
}

function clearDotsOnly() {
    csInterface.evalScript("AutoGrids_clearDotsOnly()", function () {});
}

// ----- seleção de tipo (compartilhada pelas duas grades de cartões) -----

function selectType(btn) {
    var grid = btn.parentElement;
    Array.prototype.forEach.call(grid.children, function (b) { b.classList.remove("active"); });
    btn.classList.add("active");
    state.type = btn.getAttribute("data-type");
    syncReadouts();
    requestApply();
}

els.typeGridGuias.addEventListener("click", function (e) {
    var btn = e.target.closest(".type-card");
    if (btn) selectType(btn);
});
els.typeGridPontos.addEventListener("click", function (e) {
    var btn = e.target.closest(".type-card");
    if (btn) selectType(btn);
});

// ----- abas Guias / Pontos -----

els.sectionTabs.addEventListener("click", function (e) {
    if (e.target.tagName !== "BUTTON") return;
    var next = e.target.getAttribute("data-section");
    if (next === state.section) return;

    var leavingPontos = state.section === "pontos";
    state.section = next;

    Array.prototype.forEach.call(els.sectionTabs.children, function (b) { b.classList.remove("active"); });
    e.target.classList.add("active");

    if (next === "liquido") {
        // Aba Líquido não mexe em grade/pontos: só troca o que está visível.
        syncReadouts();
        if (leavingPontos) clearDotsOnly();
        updateLiquidStatus();
        return;
    }

    // O tipo ativo dentro da aba de destino é o que já estava marcado nela.
    var destGrid = next === "pontos" ? els.typeGridPontos : els.typeGridGuias;
    var activeCard = destGrid.querySelector(".type-card.active") || destGrid.querySelector(".type-card");
    activeCard.classList.add("active");
    state.type = activeCard.getAttribute("data-type");

    syncReadouts();

    if (leavingPontos) {
        // Saiu de Pontos sem "aplicar de fato" — não deixa um preview de
        // objetos reais esquecido sobreposto às guias da prancheta ativa.
        clearDotsOnly();
    }
    requestApply();
});

// ----- toggle de unidade -----

els.unitToggle.addEventListener("click", function (e) {
    if (e.target.tagName !== "BUTTON") return;
    Array.prototype.forEach.call(els.unitToggle.children, function (b) { b.classList.remove("active"); });
    e.target.classList.add("active");
    state.unit = e.target.getAttribute("data-unit");
    syncReadouts();
});

// ----- sliders -----

els.cellSize.addEventListener("input", function () {
    state.cellSizePt = parseFloat(els.cellSize.value);
    els.cellSizeVal.value = fmt(ptToUnit(state.cellSizePt, state.unit));
    requestApply();
});
els.cellSizeVal.addEventListener("change", function () {
    var v = parseFloat(els.cellSizeVal.value.replace(",", "."));
    if (!isNaN(v)) { state.cellSizePt = unitToPt(v, state.unit); syncReadouts(); requestApply(); }
});

els.margin.addEventListener("input", function () {
    state.marginPt = parseFloat(els.margin.value);
    els.marginVal.value = fmt(ptToUnit(state.marginPt, state.unit));
    requestApply();
});
els.marginVal.addEventListener("change", function () {
    var v = parseFloat(els.marginVal.value.replace(",", "."));
    if (!isNaN(v)) { state.marginPt = unitToPt(v, state.unit); syncReadouts(); requestApply(); }
});

els.dotSize.addEventListener("input", function () {
    state.dotSizePt = parseFloat(els.dotSize.value);
    els.dotSizeVal.value = fmt(ptToUnit(state.dotSizePt, state.unit));
    requestApply();
});
els.dotSizeVal.addEventListener("change", function () {
    var v = parseFloat(els.dotSizeVal.value.replace(",", "."));
    if (!isNaN(v)) { state.dotSizePt = unitToPt(v, state.unit); syncReadouts(); requestApply(); }
});

els.intensity.addEventListener("input", function () {
    state.intensity = parseInt(els.intensity.value, 10);
    els.intensityVal.textContent = state.intensity + "%";
    requestApply();
});

// ----- Líquido -----
//
// Diferente de Guias/Pontos (que reagem à prancheta ativa), a ponte líquida
// depende de QUAIS formas o usuário selecionou. "Capturar seleção" lê a
// seleção atual uma vez e guarda a geometria em state.liquidShapes; a partir
// daí o slider só recalcula a ponte em cima desses números guardados (não
// fica relendo a seleção a cada tique). Cada captura gera uma tag nova
// (state.liquidTag), então capturar um novo par cria uma ponte independente
// — as anteriores continuam no documento, editáveis normalmente.

var liquidDebounceTimer = null;
function requestLiquidApply() {
    clearTimeout(liquidDebounceTimer);
    liquidDebounceTimer = setTimeout(doLiquidApply, 90);
}

function doLiquidApply() {
    if (!state.liquidShapes || !state.liquidTag) return;
    var s = state.liquidShapes;
    var call = "AutoLiquid_apply(" +
        '"' + state.liquidTag + '",' +
        s.s1.cx + "," + s.s1.cy + "," + s.s1.hw + "," + s.s1.hh + "," +
        s.s2.cx + "," + s.s2.cy + "," + s.s2.hw + "," + s.s2.hh + "," +
        state.liquidStrength + "," +
        s.fill.r + "," + s.fill.g + "," + s.fill.b +
        ")";
    csInterface.evalScript(call, function (result) {
        if (result && result.indexOf("ERRO") === 0) {
            updateLiquidStatus(result, "error");
        } else {
            updateLiquidStatus();
        }
    });
}

els.captureBtn.addEventListener("click", function () {
    csInterface.evalScript("AutoLiquid_captureSelection()", function (result) {
        if (!result || result.indexOf("ERRO") === 0) {
            updateLiquidStatus(result || "ERRO: falha desconhecida.", "error");
            return;
        }
        var parts = result.split("|");
        state.liquidShapes = {
            s1: { cx: parseFloat(parts[1]), cy: parseFloat(parts[2]), hw: parseFloat(parts[3]), hh: parseFloat(parts[4]) },
            s2: { cx: parseFloat(parts[5]), cy: parseFloat(parts[6]), hw: parseFloat(parts[7]), hh: parseFloat(parts[8]) },
            fill: { r: parseFloat(parts[9]), g: parseFloat(parts[10]), b: parseFloat(parts[11]) }
        };
        state.liquidTag = "liquid-" + Date.now();
        doLiquidApply();
    });
});

els.liquidStrength.addEventListener("input", function () {
    state.liquidStrength = parseInt(els.liquidStrength.value, 10);
    els.liquidStrengthVal.textContent = state.liquidStrength + "%";
    requestLiquidApply();
});

// ----- limpar -----

els.clearBtn.addEventListener("click", function () {
    if (state.section === "liquido") {
        csInterface.evalScript("AutoLiquid_clearAll()", function (result) {
            setStatus(result === "OK" ? "Conexões líquidas removidas." : result, result !== "OK");
        });
        state.liquidTag = null;
        state.liquidShapes = null;
        updateLiquidStatus();
        return;
    }
    csInterface.evalScript("AutoGrids_clear()", function (result) {
        setStatus(result === "OK" ? "Prancheta ativa limpa." : result, result !== "OK");
    });
});

// ----- inicialização -----

syncReadouts();
csInterface.evalScript("AutoGrids_getState()", function (result) {
    var parts = (result || "0|0|0").split("|");
    if (parts[0] === "1") {
        doApply();
    } else {
        setStatus("Abra um documento no Illustrator para começar.", false);
    }
});

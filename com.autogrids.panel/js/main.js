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
    intensity: 60
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

    var isPontos = state.section === "pontos";
    els.dotFields.style.display = isPontos ? "block" : "none";
    els.typeGridGuias.style.display = isPontos ? "none" : "grid";
    els.typeGridPontos.style.display = isPontos ? "grid" : "none";
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

// Carrega no painel os parâmetros de uma grade que já existe na prancheta
// (vindos de AutoGrids_getArtboardState, formato "type,cellSizePt,marginPt,
// dotSizePt,opacityPct,grayPct") sem reaplicar nada — é só reflexo do que já
// está lá, pra trocar de prancheta não arriscar sobrescrever com os valores
// que estavam ajustados na prancheta anterior.
function applyLoadedState(metaStr) {
    var fields = metaStr.split(",");
    if (fields.length < 6) return;
    var type = fields[0];

    state.type = type;
    state.cellSizePt = parseFloat(fields[1]);
    state.marginPt = parseFloat(fields[2]);
    state.dotSizePt = parseFloat(fields[3]);
    state.intensity = parseInt(fields[4], 10);
    state.section = DOT_TYPES[type] ? "pontos" : "guias";

    Array.prototype.forEach.call(els.sectionTabs.children, function (b) {
        b.classList.toggle("active", b.getAttribute("data-section") === state.section);
    });
    var destGrid = state.section === "pontos" ? els.typeGridPontos : els.typeGridGuias;
    Array.prototype.forEach.call(destGrid.children, function (b) {
        b.classList.toggle("active", b.getAttribute("data-type") === type);
    });

    syncReadouts();
}

// O CEP do Illustrator não dispara nenhum evento quando você troca a prancheta
// ativa (só documentAfterActivate/documentAfterDeactivate/applicationActivate,
// que reagem a troca de DOCUMENTO) — então a única forma confiável de notar a
// troca é perguntar de tempos em tempos. Só age quando o índice muda, e nesse
// caso só CARREGA o que já existe lá (nunca desenha nada por conta própria —
// quem desenha é sempre uma ação do usuário, via requestApply).
var lastArtboardIndex = null;
function pollArtboard() {
    csInterface.evalScript("AutoGrids_getArtboardState()", function (result) {
        var parts = (result || "0").split("|");
        if (parts[0] !== "1") return;
        var artboardIndex = parts[1];
        if (artboardIndex === lastArtboardIndex) return;
        lastArtboardIndex = artboardIndex;
        var meta = parts[4] || "";
        if (meta) applyLoadedState(meta);
    });
}
setInterval(pollArtboard, 600);

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

// ----- limpar -----

els.clearBtn.addEventListener("click", function () {
    csInterface.evalScript("AutoGrids_clear()", function (result) {
        setStatus(result === "OK" ? "Prancheta ativa limpa." : result, result !== "OK");
    });
});

// ----- inicialização -----

syncReadouts();
csInterface.evalScript("AutoGrids_getArtboardState()", function (result) {
    var parts = (result || "0").split("|");
    if (parts[0] === "1") {
        lastArtboardIndex = parts[1];
        var meta = parts[4] || "";
        if (meta) {
            // Já existe grade nesta prancheta: carrega os parâmetros dela em
            // vez de desenhar os valores padrão por cima.
            applyLoadedState(meta);
        } else {
            doApply();
        }
    } else {
        setStatus("Abra um documento no Illustrator para começar.", false);
    }
});

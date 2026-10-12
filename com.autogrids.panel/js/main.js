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
var TYPE_LABELS = {
    "rectangle": "Retangular",
    "triangle": "Isométrica",
    "lines": "Linhas",
    "hexagon": "Hexagonal",
    "four-dots": "Pontos quadrado",
    "three-dots": "Pontos triangular"
};

var state = {
    section: "guias",
    type: "rectangle",
    unit: "mm",
    cellSizePt: unitToPt(20, "mm"),
    marginPt: 0,
    gutterPt: 0,
    dotSizePt: unitToPt(1.5, "mm"),
    intensity: 60
};

var els = {
    artboardName: document.getElementById("artboardName"),
    artboardCount: document.getElementById("artboardCount"),
    artboardGrid: document.getElementById("artboardGrid"),
    sectionTabs: document.getElementById("sectionTabs"),
    typeGridGuias: document.getElementById("typeGrid-guias"),
    typeGridPontos: document.getElementById("typeGrid-pontos"),
    unitToggle: document.getElementById("unitToggle"),
    cellSize: document.getElementById("cellSize"),
    cellSizeVal: document.getElementById("cellSizeVal"),
    margin: document.getElementById("margin"),
    marginVal: document.getElementById("marginVal"),
    gutterField: document.getElementById("gutterField"),
    gutter: document.getElementById("gutter"),
    gutterVal: document.getElementById("gutterVal"),
    dotFields: document.getElementById("dotFields"),
    dotSize: document.getElementById("dotSize"),
    dotSizeVal: document.getElementById("dotSizeVal"),
    intensity: document.getElementById("intensity"),
    intensityVal: document.getElementById("intensityVal"),
    unitLabels: [
        document.getElementById("unitLabel1"), document.getElementById("unitLabel2"),
        document.getElementById("unitLabel3"), document.getElementById("unitLabel4")
    ],
    clearBtn: document.getElementById("clearBtn"),
    status: document.getElementById("status")
};

function syncReadouts() {
    els.cellSize.value = state.cellSizePt;
    els.cellSizeVal.value = fmt(ptToUnit(state.cellSizePt, state.unit));
    els.margin.value = state.marginPt;
    els.marginVal.value = fmt(ptToUnit(state.marginPt, state.unit));
    els.gutter.value = state.gutterPt;
    els.gutterVal.value = fmt(ptToUnit(state.gutterPt, state.unit));
    els.dotSize.value = state.dotSizePt;
    els.dotSizeVal.value = fmt(ptToUnit(state.dotSizePt, state.unit));
    els.intensity.value = state.intensity;
    els.intensityVal.textContent = state.intensity + "%";
    els.unitLabels.forEach(function (el) { el.textContent = state.unit; });

    var isPontos = state.section === "pontos";
    els.dotFields.style.display = isPontos ? "block" : "none";
    // Gutter só existe para guias: nos pontos o próprio tamanho da célula já é
    // o espaçamento entre eles.
    els.gutterField.style.display = isPontos ? "none" : "block";
    els.typeGridGuias.style.display = isPontos ? "none" : "grid";
    els.typeGridPontos.style.display = isPontos ? "grid" : "none";
}

function setStatus(msg, isError) {
    els.status.textContent = msg;
    els.status.className = isError ? "error" : "";
}

// ----- prancheta ativa (cabeçalho) -----

function renderArtboard(index, count, name, meta) {
    els.artboardName.textContent = name || "—";
    els.artboardName.title = name || "";
    els.artboardCount.textContent = (parseInt(index, 10) + 1) + " de " + count;
    if (!meta) {
        els.artboardGrid.textContent = "Sem grade nesta prancheta";
        return;
    }
    var f = meta.split(",");
    var summary = (TYPE_LABELS[f[0]] || f[0]) + " · " + fmt(ptToUnit(parseFloat(f[1]), state.unit)) + " " + state.unit;
    var gutter = parseFloat(f[6]) || 0;
    if (gutter > 0 && !DOT_TYPES[f[0]]) summary += " · gutter " + fmt(ptToUnit(gutter, state.unit)) + " " + state.unit;
    els.artboardGrid.textContent = summary;
}

function renderNoDocument() {
    els.artboardName.textContent = "Nenhum documento aberto";
    els.artboardName.title = "";
    els.artboardCount.textContent = "";
    els.artboardGrid.textContent = "";
}

// "1|índice|total|larguraPt|alturaPt|meta|documento|nome" — ver
// AutoGrids_getArtboardState. "key" identifica a prancheta ativa entre
// documentos: só o índice não basta (a prancheta 1 de outro documento também
// tem índice 0).
function parseArtboardState(result) {
    var parts = (result || "0").split("|");
    if (parts[0] !== "1") return null;
    return {
        index: parts[1],
        count: parts[2],
        meta: parts[5] || "",
        key: parts[6] + "#" + parts[1],
        name: parts.slice(7).join("|")
    };
}

// ----- aplicação ao vivo -----
//
// Antes: debounce de 90 ms — só desenhava quando o slider parava. Agora: no
// máximo UMA chamada em andamento e, enquanto ela roda, só a mais recente fica
// na fila (as intermediárias são descartadas). Assim a grade acompanha o
// arraste na velocidade que o Illustrator aguenta, sem acumular atraso, e
// sempre termina no valor final. "live" = ainda arrastando (o host pula o
// redesenho forçado); ao soltar vai uma última chamada sem "live".
var applyInFlight = false;
var applyStartedAt = 0;
var queuedApply = null;
var APPLY_TIMEOUT_MS = 4000;

function requestApply(live) {
    var wasFinal = queuedApply && !queuedApply.live;
    queuedApply = { live: !!live && !wasFinal };
    pumpApply();
}

function pumpApply() {
    if (!queuedApply) return;
    // Se o Illustrator engolir uma resposta (diálogo modal aberto etc.), não
    // deixa o painel travado para sempre esperando por ela.
    if (applyInFlight && Date.now() - applyStartedAt < APPLY_TIMEOUT_MS) return;
    var job = queuedApply;
    queuedApply = null;
    applyInFlight = true;
    applyStartedAt = Date.now();
    var call = "AutoGrids_apply(" +
        '"' + state.type + '",' +
        state.cellSizePt + "," +
        state.marginPt + "," +
        state.dotSizePt + "," +
        state.intensity + "," +
        state.intensity + "," +
        state.gutterPt + "," +
        (job.live ? "true" : "false") +
        ")";
    csInterface.evalScript(call, function (result) {
        applyInFlight = false;
        if (result && result.indexOf("ERRO") === 0) {
            setStatus(result, true);
        } else if (result && result.indexOf("DENSO|") === 0) {
            // Grade pesada demais para redesenhar a cada pixel do arraste (ver
            // "Orçamento de objetos" no host.jsx) — ela é aplicada ao soltar.
            setStatus("Grade densa (cerca de " + result.split("|")[1] + " objetos): atualiza ao soltar o controle.", false);
        } else {
            setStatus(job.live ? "Atualizando…" : "Grade atualizada.", false);
        }
        pumpApply();
    });
}

function clearDotsOnly() {
    csInterface.evalScript("AutoGrids_clearDotsOnly()", function () {});
}

// Carrega no painel os parâmetros de uma grade que já existe na prancheta
// (formato "type,cellSizePt,marginPt,dotSizePt,opacityPct,grayPct,gutterPt")
// sem reaplicar nada — é só reflexo do que já está lá, pra trocar de prancheta
// não arriscar sobrescrever com os valores ajustados na prancheta anterior.
function applyLoadedState(metaStr) {
    var fields = metaStr.split(",");
    if (fields.length < 6) return;
    var type = fields[0];

    state.type = type;
    state.cellSizePt = parseFloat(fields[1]);
    state.marginPt = parseFloat(fields[2]);
    state.dotSizePt = parseFloat(fields[3]);
    state.intensity = parseInt(fields[4], 10);
    state.gutterPt = parseFloat(fields[6]) || 0;
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

function syncNames() {
    csInterface.evalScript("AutoGrids_syncNames()", function () {});
}

// O CEP do Illustrator não dispara nenhum evento quando você troca a prancheta
// ativa (só documentAfterActivate/documentAfterDeactivate/applicationActivate,
// que reagem a troca de DOCUMENTO) — então a única forma confiável de notar a
// troca é perguntar de tempos em tempos. O cabeçalho é atualizado sempre (pega
// também renomeações); os controles só são recarregados quando a prancheta
// ativa muda (de número ou de documento), e nunca desenham nada por conta própria.
var lastArtboardKey = null;
function pollArtboard() {
    if (applyInFlight) return;
    csInterface.evalScript("AutoGrids_getArtboardState()", function (result) {
        var s = parseArtboardState(result);
        if (!s) {
            lastArtboardKey = null;
            renderNoDocument();
            return;
        }
        renderArtboard(s.index, s.count, s.name, s.meta);
        if (s.key === lastArtboardKey) return;
        lastArtboardKey = s.key;
        if (s.meta) applyLoadedState(s.meta);
        syncNames();
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
    requestApply(false);
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
    requestApply(false);
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
//
// "input" dispara a cada pixel do arraste (aplicação ao vivo); "change" só ao
// soltar (aplicação final, com redesenho forçado).

function bindSlider(range, box, key) {
    range.addEventListener("input", function () {
        state[key] = parseFloat(range.value);
        box.value = fmt(ptToUnit(state[key], state.unit));
        requestApply(true);
    });
    range.addEventListener("change", function () {
        requestApply(false);
    });
    box.addEventListener("change", function () {
        var v = parseFloat(box.value.replace(",", "."));
        if (!isNaN(v)) { state[key] = unitToPt(v, state.unit); syncReadouts(); requestApply(false); }
    });
}

bindSlider(els.cellSize, els.cellSizeVal, "cellSizePt");
bindSlider(els.margin, els.marginVal, "marginPt");
bindSlider(els.gutter, els.gutterVal, "gutterPt");
bindSlider(els.dotSize, els.dotSizeVal, "dotSizePt");

els.intensity.addEventListener("input", function () {
    state.intensity = parseInt(els.intensity.value, 10);
    els.intensityVal.textContent = state.intensity + "%";
    requestApply(true);
});
els.intensity.addEventListener("change", function () {
    requestApply(false);
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
    var s = parseArtboardState(result);
    if (!s) {
        renderNoDocument();
        setStatus("Abra um documento no Illustrator para começar.", false);
        return;
    }
    lastArtboardKey = s.key;
    renderArtboard(s.index, s.count, s.name, s.meta);
    syncNames();
    if (s.meta) {
        // Já existe grade nesta prancheta: carrega os parâmetros dela em vez
        // de desenhar os valores padrão por cima.
        applyLoadedState(s.meta);
    } else {
        requestApply(false);
    }
});

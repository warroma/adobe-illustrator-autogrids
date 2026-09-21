var csInterface = new CSInterface();

// Diferente do AutoGrids (que reage à prancheta ativa), a ponte líquida
// depende de QUAIS formas o usuário selecionou. "Capturar seleção" lê a
// seleção atual uma vez e guarda a geometria em state.shapes; a partir daí
// o slider só recalcula a ponte em cima desses números guardados (não fica
// relendo a seleção a cada tique). Cada captura gera uma tag nova
// (state.tag), então capturar um novo par cria uma ponte independente — as
// anteriores continuam no documento, editáveis normalmente.

var state = {
    strength: 50,
    tag: null,
    shapes: null
};

var els = {
    status: document.getElementById("liquidStatus"),
    captureBtn: document.getElementById("captureBtn"),
    strength: document.getElementById("liquidStrength"),
    strengthVal: document.getElementById("liquidStrengthVal"),
    clearBtn: document.getElementById("clearBtn")
};

function updateStatus(msg, kind) {
    if (msg) {
        els.status.textContent = msg;
    } else if (state.shapes) {
        els.status.textContent = "Conexão capturada — ajuste a pregnância ou capture outro par.";
        kind = "ok";
    } else {
        els.status.textContent = "Selecione 2 formas (círculo, elipse ou retângulo) no artboard e clique em \"Capturar seleção\".";
    }
    els.status.className = "liquid-status" + (kind ? " " + kind : "");
}

var debounceTimer = null;
function requestApply() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(doApply, 90);
}

function doApply() {
    if (!state.shapes || !state.tag) return;
    var s = state.shapes;
    var call = "AutoLiquid_apply(" +
        '"' + state.tag + '",' +
        s.s1.cx + "," + s.s1.cy + "," + s.s1.hw + "," + s.s1.hh + "," +
        s.s2.cx + "," + s.s2.cy + "," + s.s2.hw + "," + s.s2.hh + "," +
        state.strength + "," +
        s.fill.r + "," + s.fill.g + "," + s.fill.b +
        ")";
    csInterface.evalScript(call, function (result) {
        if (result && result.indexOf("ERRO") === 0) {
            updateStatus(result, "error");
        } else {
            updateStatus();
        }
    });
}

els.captureBtn.addEventListener("click", function () {
    csInterface.evalScript("AutoLiquid_captureSelection()", function (result) {
        if (!result || result.indexOf("ERRO") === 0) {
            updateStatus(result || "ERRO: falha desconhecida.", "error");
            return;
        }
        var parts = result.split("|");
        state.shapes = {
            s1: { cx: parseFloat(parts[1]), cy: parseFloat(parts[2]), hw: parseFloat(parts[3]), hh: parseFloat(parts[4]) },
            s2: { cx: parseFloat(parts[5]), cy: parseFloat(parts[6]), hw: parseFloat(parts[7]), hh: parseFloat(parts[8]) },
            fill: { r: parseFloat(parts[9]), g: parseFloat(parts[10]), b: parseFloat(parts[11]) }
        };
        state.tag = "liquid-" + Date.now();
        doApply();
    });
});

els.strength.addEventListener("input", function () {
    state.strength = parseInt(els.strength.value, 10);
    els.strengthVal.textContent = state.strength + "%";
    requestApply();
});

els.clearBtn.addEventListener("click", function () {
    csInterface.evalScript("AutoLiquid_clearAll()", function (result) {
        updateStatus(result === "OK" ? "Conexões líquidas removidas." : result, result === "OK" ? "ok" : "error");
    });
    state.tag = null;
    state.shapes = null;
});

// ----- inicialização -----

updateStatus();

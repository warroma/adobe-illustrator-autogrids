"use strict";

var foundEl = document.getElementById("found");
var introEl = document.getElementById("intro");
var panelsEl = document.getElementById("panels");
var runningWarnEl = document.getElementById("runningWarn");
var installBtn = document.getElementById("installBtn");
var doneEl = document.getElementById("done");
var doneTitleEl = document.getElementById("doneTitle");
var doneListEl = document.getElementById("doneList");
var doneRestartEl = document.getElementById("doneRestart");
var doneMenusEl = document.getElementById("doneMenus");
var logEl = document.getElementById("log");

// Um cartão por painel do instalador (ver src/panels.js), cada um com o seu
// cenário (detect.planInstall) e uma caixa para escolher se entra ou não.
var panels = [];      // o que veio de detect-illustrator, + { checkbox, planEl, done }
var installedOk = []; // painéis já instalados nesta sessão (para a mensagem final)

function appendLog(lines) {
    (lines || []).forEach(function (line) {
        logEl.textContent += line + "\n";
    });
}

// Texto do cartão para cada cenário.
function planText(p) {
    var installed = (p.installed && p.installed.version) || "versão desconhecida";
    var bundled = p.bundledVersion || "nova";
    switch (p.mode) {
        case "update":
            return "Atualização disponível: versão instalada " + installed + " → " + bundled + ".";
        case "reinstall":
            return "A versão " + bundled + " já está instalada. Marque para reinstalar (copia tudo de novo, sem mudar de versão).";
        case "downgrade":
            return "A versão instalada (" + installed + ") é mais nova que a deste instalador (" + bundled + "). Marque só se quiser voltar para a " + bundled + ".";
        case "linked":
            return "A pasta do painel hoje é um atalho para " + ((p.installed && p.installed.linkTarget) || "o código-fonte") +
                " (usado para desenvolver o painel). Instalar troca o atalho por uma cópia da versão " + bundled +
                " — os arquivos de lá não são alterados.";
        default:
            return "Ainda não instalado. Versão " + bundled + ".";
    }
}

// Texto do botão a partir dos painéis marcados, juntando os que têm a mesma
// ação: "Instalar AutoGrids e AutoPhysics", "Atualizar AutoGrids e instalar
// AutoPhysics".
function buttonText(sel) {
    var groups = [];
    sel.forEach(function (p) {
        var verb = { update: "atualizar", reinstall: "reinstalar" }[p.mode] || "instalar";
        if (p.mode === "downgrade") {
            groups.push({ phrase: "voltar " + p.name + " para a " + p.bundledVersion });
            return;
        }
        var g = groups.filter(function (x) { return x.verb === verb; })[0];
        if (g) g.names.push(p.name);
        else groups.push({ verb: verb, names: [p.name] });
    });
    var text = groups.map(function (g) { return g.phrase || g.verb + " " + g.names.join(" e "); }).join(" e ");
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function successText(r, mode) {
    if (r.replacedLink) return r.name + ": versão " + r.version + " instalada no lugar do atalho para o código-fonte.";
    if (mode === "update") return r.name + ": atualizado de " + (r.previousVersion || "versão anterior") + " para " + r.version + ".";
    if (mode === "reinstall") return r.name + ": versão " + r.version + " reinstalada.";
    return r.name + ": versão " + r.version + " instalada.";
}

function selectedPanels() {
    return panels.filter(function (p) { return !p.done && p.checkbox.checked; });
}

function refreshButton() {
    var sel = selectedPanels();
    if (sel.length === 0) {
        installBtn.textContent = "Escolha ao menos um painel";
        installBtn.disabled = true;
        return;
    }
    installBtn.textContent = buttonText(sel);
    installBtn.disabled = false;
}

// Ano do Illustrator mais novo encontrado (0 = não deu para saber).
function newestYear(installs) {
    return installs.reduce(function (max, i) { return Math.max(max, i.year || 0); }, 0);
}

function renderPanels(list, installs) {
    var newest = newestYear(installs);
    // Pré-marcados: o que é novo ou tem atualização. Se não há nada disso
    // (tudo já instalado na mesma versão), marca os de reinstalar — é o caso
    // de quem abriu o instalador justamente para reinstalar. Voltar versão
    // nunca vem marcado.
    var anyFresh = list.some(function (p) { return p.available && /^(install|update|linked)$/.test(p.mode); });
    panelsEl.innerHTML = "";
    panels = list.map(function (p) {
        var card = document.createElement("label");
        card.className = "panel-card";
        var cb = document.createElement("input");
        cb.type = "checkbox";
        var tooOld = p.minYear && newest > 0 && newest < p.minYear;
        cb.checked = p.available && !tooOld && (anyFresh ? /^(install|update|linked)$/.test(p.mode) : p.mode === "reinstall");
        cb.disabled = !p.available;
        var body = document.createElement("div");
        body.className = "panel-body";
        var head = document.createElement("div");
        head.className = "panel-head";
        var name = document.createElement("strong");
        name.textContent = p.name;
        var ver = document.createElement("span");
        ver.className = "panel-version";
        ver.textContent = p.bundledVersion ? "versão " + p.bundledVersion : "";
        head.appendChild(name);
        head.appendChild(ver);
        var desc = document.createElement("div");
        desc.className = "panel-desc";
        desc.textContent = p.description;
        var plan = document.createElement("div");
        plan.className = "panel-plan";
        plan.textContent = p.available ? planText(p) : "Este instalador veio sem os arquivos deste painel.";
        body.appendChild(head);
        body.appendChild(desc);
        body.appendChild(plan);
        if (tooOld) {
            var note = document.createElement("div");
            note.className = "panel-note";
            note.textContent = "Precisa do Illustrator " + p.minYear + " ou mais recente — o mais novo encontrado aqui é o " + newest + ".";
            body.appendChild(note);
        }
        card.appendChild(cb);
        card.appendChild(body);
        panelsEl.appendChild(card);
        cb.addEventListener("change", refreshButton);
        return Object.assign({}, p, { checkbox: cb, planEl: plan, card: card, done: false });
    });
    refreshButton();
}

window.autogridsInstaller.detectIllustrator().then(function (result) {
    var installs = (result && result.installs) || [];
    if (installs.length === 0) {
        introEl.textContent = "Não encontramos uma instalação do Illustrator automaticamente — isso não impede a instalação dos painéis, só confirme que o Illustrator já está instalado antes de abri-lo depois.";
    } else {
        introEl.textContent = "Encontramos:";
        installs.forEach(function (item) {
            var li = document.createElement("li");
            li.textContent = item.name;
            foundEl.appendChild(li);
        });
    }
    if (!result || !result.ok) {
        appendLog(["ERRO: " + ((result && result.error) || "não foi possível verificar os painéis instalados.")]);
    }
    renderPanels((result && result.panels) || [], installs);
    runningWarnEl.hidden = !(result && result.running);
});

installBtn.addEventListener("click", function () {
    var sel = selectedPanels();
    if (!sel.length) return;
    installBtn.disabled = true;
    installBtn.textContent = "Instalando...";
    panels.forEach(function (p) { p.checkbox.disabled = true; });
    window.autogridsInstaller.runInstall(sel.map(function (p) { return p.id; })).then(function (result) {
        appendLog(result.log);
        var failed = [];
        (result.panels || []).forEach(function (r) {
            var p = panels.filter(function (x) { return x.id === r.id; })[0];
            if (!p) return;
            if (r.ok) {
                p.done = true;
                p.checkbox.checked = true;
                p.card.classList.add("installed");
                p.planEl.textContent = "✓ " + successText(r, p.mode);
                installedOk.push({ name: p.name, text: successText(r, p.mode) });
            } else {
                failed.push(p);
                p.planEl.textContent = "Falhou: " + r.error;
                p.card.classList.add("failed");
            }
        });
        if (!result.ok && !(result.panels || []).length) {
            appendLog(["ERRO: " + result.error]);
            failed = sel;
        }
        // Os que falharam continuam marcados para "tentar de novo".
        panels.forEach(function (p) { p.checkbox.disabled = p.done || !p.available; });

        if (installedOk.length) {
            doneTitleEl.textContent = failed.length ? "Parte dos painéis foi instalada:" : "Pronto!";
            doneListEl.innerHTML = "";
            installedOk.forEach(function (i) {
                var li = document.createElement("li");
                li.textContent = i.text;
                doneListEl.appendChild(li);
            });
            doneMenusEl.textContent = "Janela > Extensões > " + installedOk.map(function (i) { return i.name; }).join(" ou ");
            // O aviso de fechar e reabrir aparece SEMPRE: o Illustrator só lê
            // uma extensão CEP nova ou atualizada ao ser aberto. Se ele ainda
            // está aberto agora, o texto fica mais direto.
            if (result.running) {
                doneRestartEl.innerHTML = "O Illustrator está aberto agora. Para os painéis funcionarem corretamente, " +
                    "<strong>feche-o por completo (Arquivo &gt; Sair) e abra de novo</strong> — até lá ele continua usando a versão anterior.";
            }
            doneEl.hidden = false;
            runningWarnEl.hidden = true;
        }
        if (result.debugPartial) {
            appendLog(["", "Aviso: nem todas as versões do modo de depuração do CEP puderam ser habilitadas — se um painel não aparecer no menu, isso pode ser o motivo."]);
        }
        if (failed.length) {
            installBtn.textContent = "Falhou — tentar de novo (" + failed.map(function (p) { return p.name; }).join(", ") + ")";
            installBtn.disabled = false;
            if ((result.panels || []).some(function (r) { return !r.ok && /EBUSY|EPERM|EACCES/.test(r.error || ""); })) {
                appendLog(["Dica: feche o Illustrator e tente de novo — ele pode estar segurando os arquivos do painel."]);
            }
        } else {
            installBtn.hidden = true;
        }
    });
});

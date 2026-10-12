"use strict";

var foundEl = document.getElementById("found");
var introEl = document.getElementById("intro");
var installBtn = document.getElementById("installBtn");
var logEl = document.getElementById("log");

function appendLog(lines) {
    (lines || []).forEach(function (line) {
        logEl.textContent += line + "\n";
    });
}

window.autogridsInstaller.detectIllustrator().then(function (result) {
    var installs = (result && result.installs) || [];
    if (installs.length === 0) {
        introEl.textContent = "Não encontramos uma instalação do Illustrator automaticamente — isso não impede a instalação do painel, só confirme que o Illustrator já está instalado antes de abri-lo depois.";
    } else {
        introEl.textContent = "Encontramos:";
        installs.forEach(function (item) {
            var li = document.createElement("li");
            li.textContent = item.name;
            foundEl.appendChild(li);
        });
    }
    installBtn.disabled = false;
});

installBtn.addEventListener("click", function () {
    installBtn.disabled = true;
    installBtn.textContent = "Instalando...";
    window.autogridsInstaller.runInstall().then(function (result) {
        appendLog(result.log);
        if (result.ok) {
            installBtn.textContent = "Instalado!";
            appendLog(["", "Pronto. Reinicie o Illustrator por completo (fechar e abrir de novo) e procure em Janela > Extensões > AutoGrids."]);
            if (result.debugPartial) {
                appendLog(["", "Aviso: nem todas as versões do modo de depuração do CEP puderam ser habilitadas — se o painel não aparecer no menu, isso pode ser o motivo."]);
            }
        } else {
            installBtn.textContent = "Falhou — ver detalhes abaixo";
            installBtn.disabled = false;
            appendLog(["ERRO: " + result.error]);
        }
    });
});

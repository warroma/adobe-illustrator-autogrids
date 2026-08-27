// AutoGrids — motor ExtendScript chamado pelo painel CEP via evalScript.
// Convenção: todas as entradas numéricas chegam em pontos (pt); o painel HTML
// já converte mm/in/pt antes de montar a chamada. Nada de JSON aqui — os
// argumentos cruzam a ponte como parâmetros posicionais simples.

var GUIDE_LAYER_NAME = "AutoGrids Guides";
var DOTS_LAYER_NAME = "AutoGrids Pontos";
var TAG_PREFIX = "AutoGrids:ab";

// ===== Geometria compartilhada =====

function getArtboardBounds(doc, artboardIndex) {
    var ab = doc.artboards[artboardIndex];
    var r = ab.artboardRect;
    return {
        left: Math.min(r[0], r[2]),
        right: Math.max(r[0], r[2]),
        bottom: Math.min(r[1], r[3]),
        top: Math.max(r[1], r[3])
    };
}

function insetBounds(b, margin) {
    return {
        left: b.left + margin,
        right: b.right - margin,
        bottom: b.bottom + margin,
        top: b.top - margin
    };
}

function boundsValid(b) {
    return (b.right - b.left) > 0 && (b.top - b.bottom) > 0;
}

// Recorte de Liang-Barsky: intersecta a reta infinita P0 + t*dir com o retângulo b.
function clipLineToRect(x0, y0, dx, dy, b) {
    var tmin = -Infinity, tmax = Infinity;
    var p = [-dx, dx, -dy, dy];
    var q = [x0 - b.left, b.right - x0, y0 - b.bottom, b.top - y0];
    for (var i = 0; i < 4; i++) {
        if (p[i] === 0) {
            if (q[i] < 0) return null;
        } else {
            var r = q[i] / p[i];
            if (p[i] < 0) {
                if (r > tmax) return null;
                if (r > tmin) tmin = r;
            } else {
                if (r < tmin) return null;
                if (r < tmax) tmax = r;
            }
        }
    }
    if (tmin > tmax) return null;
    return {
        x1: x0 + tmin * dx, y1: y0 + tmin * dy,
        x2: x0 + tmax * dx, y2: y0 + tmax * dy
    };
}

// ===== Camadas =====
//
// As camadas "AutoGrids Guides"/"AutoGrids Pontos" são compartilhadas por TODAS
// as pranchetas do documento (uma camada por documento, não por prancheta).
// Por isso cada objeto criado é marcado em .name com a prancheta a que pertence
// (TAG_PREFIX + índice) — ao reaplicar/limpar, só mexemos nos objetos com a
// marca da prancheta ATIVA no momento. Sem isso, aplicar uma grade na prancheta
// 2 apagava a grade que já existia na prancheta 1 (mesma camada, limpeza geral).

function getOrCreateLayer(doc, name) {
    var layer;
    try {
        layer = doc.layers.getByName(name);
    } catch (e) {
        layer = doc.layers.add();
        layer.name = name;
    }
    layer.locked = false;
    layer.visible = true;
    return layer;
}

function tagFor(artboardIndex) {
    return TAG_PREFIX + artboardIndex;
}

function clearArtboardTagged(layer, artboardIndex) {
    var tag = tagFor(artboardIndex);
    for (var i = layer.pageItems.length - 1; i >= 0; i--) {
        var item = layer.pageItems[i];
        if (item.name === tag) item.remove();
    }
}

function clearAllTagged(layer) {
    for (var i = layer.pageItems.length - 1; i >= 0; i--) {
        var item = layer.pageItems[i];
        if (item.name && item.name.indexOf(TAG_PREFIX) === 0) item.remove();
    }
}

// ===== Guias de linha (não imprimem: layer.guides = true) =====

function addGuideLine(layer, tag, x1, y1, x2, y2) {
    var line = layer.pathItems.add();
    line.setEntirePath([[x1, y1], [x2, y2]]);
    line.stroked = false;
    line.filled = false;
    line.guides = true;
    line.name = tag;
}

function buildRectangularGuides(layer, tag, b, spacing) {
    var x, y;
    for (x = b.left; x <= b.right + 0.001; x += spacing) addGuideLine(layer, tag, x, b.bottom, x, b.top);
    for (y = b.bottom; y <= b.top + 0.001; y += spacing) addGuideLine(layer, tag, b.left, y, b.right, y);
}

function buildRuledGuides(layer, tag, b, spacing) {
    for (var y = b.bottom; y <= b.top + 0.001; y += spacing) addGuideLine(layer, tag, b.left, y, b.right, y);
}

// Família de retas paralelas ao ângulo dado, espaçadas por "spacing" (perpendicular
// à direção), centradas em b e recortadas nos limites de b.
function buildLineFamily(layer, tag, b, angleDeg, spacing) {
    var rad = angleDeg * Math.PI / 180;
    var dx = Math.cos(rad), dy = Math.sin(rad);
    if (Math.abs(dx) < 1e-9) dx = 0;
    if (Math.abs(dy) < 1e-9) dy = 0;
    var nx = -dy, ny = dx;
    var cx = (b.left + b.right) / 2, cy = (b.bottom + b.top) / 2;
    var diag = Math.sqrt(Math.pow(b.right - b.left, 2) + Math.pow(b.top - b.bottom, 2));
    var kMax = Math.ceil(diag / spacing) + 1;
    for (var k = -kMax; k <= kMax; k++) {
        var px = cx + k * spacing * nx;
        var py = cy + k * spacing * ny;
        var seg = clipLineToRect(px, py, dx, dy, b);
        if (seg) addGuideLine(layer, tag, seg.x1, seg.y1, seg.x2, seg.y2);
    }
}

function buildIsometricGuides(layer, tag, b, spacing) {
    buildLineFamily(layer, tag, b, 90, spacing);
    buildLineFamily(layer, tag, b, 30, spacing);
    buildLineFamily(layer, tag, b, 150, spacing);
}

// Hexágonos "pointy-top" ladrilhados (linhas de contorno = guias, não-imprimíveis).
function addHexGuide(layer, tag, cx, cy, r) {
    var pts = [];
    for (var i = 0; i < 6; i++) {
        var ang = (60 * i - 30) * Math.PI / 180;
        pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
    }
    for (i = 0; i < 6; i++) {
        var a = pts[i], c = pts[(i + 1) % 6];
        addGuideLine(layer, tag, a[0], a[1], c[0], c[1]);
    }
}

function buildHexGuides(layer, tag, b, size) {
    var r = size;
    var hSpacing = r * Math.sqrt(3);
    var vSpacing = r * 1.5;
    var margin = r * 1.2;
    var row = 0;
    for (var cy = b.bottom - margin; cy <= b.top + margin; cy += vSpacing) {
        var offset = (row % 2 === 0) ? 0 : hSpacing / 2;
        for (var cx = b.left - margin + offset; cx <= b.right + margin; cx += hSpacing) {
            addHexGuide(layer, tag, cx, cy, r);
        }
        row++;
    }
}

// ===== Pontos (objetos reais preenchidos — imprimem, não são guias) =====

// pathItems.ellipse() cria a geometria certinha, mas objetos criados assim via
// evalScript (ponte do CEP) não aparecem em tela até algum outro repaint externo
// acontecer (ex.: redimensionar a janela) — bug específico dessa combinação.
// Paths "manuais" via setEntirePath (mesmo método usado pelas guias, que sempre
// renderizaram bem) não sofrem disso, então construímos o círculo com 4 curvas
// bezier em vez de usar o atalho .ellipse().
var BEZIER_K = 0.5522847498;
function addDot(layer, tag, cx, cy, diameter, opacityPct, grayPct) {
    var r = diameter / 2;
    var k = r * BEZIER_K;
    // Pontos em ordem ao redor do círculo (direita, cima, esquerda, baixo) —
    // NÃO pular de um lado a outro, senão o path se autointersecta.
    var dot = layer.pathItems.add();
    dot.setEntirePath([
        [cx + r, cy], [cx, cy + r], [cx - r, cy], [cx, cy - r]
    ]);
    var p = dot.pathPoints;
    p[0].leftDirection = [cx + r, cy - k]; p[0].rightDirection = [cx + r, cy + k];
    p[1].leftDirection = [cx + k, cy + r]; p[1].rightDirection = [cx - k, cy + r];
    p[2].leftDirection = [cx - r, cy + k]; p[2].rightDirection = [cx - r, cy - k];
    p[3].leftDirection = [cx - k, cy - r]; p[3].rightDirection = [cx + k, cy - r];
    dot.closed = true;
    dot.stroked = false;
    dot.filled = true;
    var gray = Math.round(255 * (1 - grayPct / 100));
    var c = new RGBColor();
    c.red = gray; c.green = gray; c.blue = gray;
    dot.fillColor = c;
    dot.opacity = opacityPct;
    dot.name = tag;
}

function buildSquareDots(layer, tag, b, spacing, diameter, opacityPct, grayPct) {
    for (var x = b.left; x <= b.right + 0.001; x += spacing) {
        for (var y = b.bottom; y <= b.top + 0.001; y += spacing) {
            addDot(layer, tag, x, y, diameter, opacityPct, grayPct);
        }
    }
}

function buildTriangularDots(layer, tag, b, spacing, diameter, opacityPct, grayPct) {
    var vSpacing = spacing * Math.sqrt(3) / 2;
    var row = 0;
    for (var y = b.bottom; y <= b.top + 0.001; y += vSpacing) {
        var offset = (row % 2 === 0) ? 0 : spacing / 2;
        for (var x = b.left + offset; x <= b.right + 0.001; x += spacing) {
            addDot(layer, tag, x, y, diameter, opacityPct, grayPct);
        }
        row++;
    }
}

// ===== Pontos de entrada chamados pelo painel =====

function AutoGrids_ping() {
    try {
        var info = "app.name=" + app.name + " | documents.length=" + app.documents.length;
        if (app.documents.length > 0) {
            var doc = app.activeDocument;
            info += " | activeDocument.name=" + doc.name;
            info += " | artboards.length=" + doc.artboards.length;
            info += " | activeArtboardIndex=" + doc.artboards.getActiveArtboardIndex();
        }
        return info;
    } catch (err) {
        return "ERRO: " + err.message + " (line " + err.line + ")";
    }
}

// Retorna "hasDoc|widthPt|heightPt" para o painel sincronizar o estado inicial.
function AutoGrids_getState() {
    try {
        if (app.documents.length === 0) return "0|0|0";
        var doc = app.activeDocument;
        var b = getArtboardBounds(doc, doc.artboards.getActiveArtboardIndex());
        return "1|" + (b.right - b.left) + "|" + (b.top - b.bottom);
    } catch (err) {
        return "0|0|0";
    }
}

var DOT_TYPES = { "four-dots": 1, "three-dots": 1 };

// Aplica SEMPRE na prancheta ativa NO MOMENTO do clique em "Aplicar" — só
// mexe nos objetos marcados com a tag dessa prancheta, nunca nas outras.
function AutoGrids_apply(type, cellSize, margin, dotSize, opacityPct, grayPct) {
    try {
        if (app.documents.length === 0) return "ERRO: Abra um documento no Illustrator.";
        var doc = app.activeDocument;
        var artboardIndex = doc.artboards.getActiveArtboardIndex();
        var tag = tagFor(artboardIndex);
        var raw = getArtboardBounds(doc, artboardIndex);
        var b = insetBounds(raw, margin);
        if (!boundsValid(b)) return "ERRO: A margem é maior que a prancheta ativa.";
        if (!(cellSize > 0)) return "ERRO: Tamanho de célula inválido.";

        if (DOT_TYPES[type]) {
            var dotsLayer = getOrCreateLayer(doc, DOTS_LAYER_NAME);
            clearArtboardTagged(dotsLayer, artboardIndex);
            if (type === "four-dots") buildSquareDots(dotsLayer, tag, b, cellSize, dotSize, opacityPct, grayPct);
            else buildTriangularDots(dotsLayer, tag, b, cellSize, dotSize, opacityPct, grayPct);
            dotsLayer.locked = false;
        } else {
            var guideLayer = getOrCreateLayer(doc, GUIDE_LAYER_NAME);
            clearArtboardTagged(guideLayer, artboardIndex);
            if (type === "rectangle") buildRectangularGuides(guideLayer, tag, b, cellSize);
            else if (type === "triangle") buildIsometricGuides(guideLayer, tag, b, cellSize);
            else if (type === "lines") buildRuledGuides(guideLayer, tag, b, cellSize);
            else if (type === "hexagon") buildHexGuides(guideLayer, tag, b, cellSize);
            else return "ERRO: tipo de grade desconhecido: " + type;
            guideLayer.locked = true;
        }
        app.redraw();
        return "OK";
    } catch (err) {
        return "ERRO: " + err.message + " (line " + err.line + ")";
    }
}

// Chamado quando o painel sai da aba "Pontos" sem o usuário ter clicado em
// "Aplicar" — evita que um preview de pontos (objetos reais, imprimíveis) da
// prancheta ativa fique esquecido. Só mexe na prancheta ativa no momento.
function AutoGrids_clearDotsOnly() {
    try {
        if (app.documents.length === 0) return "OK";
        var doc = app.activeDocument;
        var dl = doc.layers.getByName(DOTS_LAYER_NAME);
        clearArtboardTagged(dl, doc.artboards.getActiveArtboardIndex());
        app.redraw();
        return "OK";
    } catch (e) {
        return "OK";
    }
}

// Botão "Limpar prancheta": remove guias + pontos só da prancheta ativa no momento.
function AutoGrids_clear() {
    try {
        if (app.documents.length === 0) return "OK";
        var doc = app.activeDocument;
        var artboardIndex = doc.artboards.getActiveArtboardIndex();
        try {
            var gl = doc.layers.getByName(GUIDE_LAYER_NAME);
            gl.locked = false;
            clearArtboardTagged(gl, artboardIndex);
        } catch (e1) { /* ainda não existe */ }
        try {
            var dl = doc.layers.getByName(DOTS_LAYER_NAME);
            clearArtboardTagged(dl, artboardIndex);
        } catch (e2) { /* ainda não existe */ }
        app.redraw();
        return "OK";
    } catch (err) {
        return "ERRO: " + err.message;
    }
}

// Remove AutoGrids de TODAS as pranchetas do documento (ação explícita, sem
// atalho no painel por padrão — reservado para quando quiser mesmo zerar tudo).
function AutoGrids_clearAll() {
    try {
        if (app.documents.length === 0) return "OK";
        var doc = app.activeDocument;
        try {
            var gl = doc.layers.getByName(GUIDE_LAYER_NAME);
            gl.locked = false;
            clearAllTagged(gl);
        } catch (e1) { /* ainda não existe */ }
        try {
            var dl = doc.layers.getByName(DOTS_LAYER_NAME);
            clearAllTagged(dl);
        } catch (e2) { /* ainda não existe */ }
        app.redraw();
        return "OK";
    } catch (err) {
        return "ERRO: " + err.message;
    }
}

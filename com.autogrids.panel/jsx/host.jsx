// AutoGrids — motor ExtendScript chamado pelo painel CEP via evalScript.
// Convenção: todas as entradas numéricas chegam em pontos (pt); o painel HTML
// já converte mm/in/pt antes de montar a chamada. Nada de JSON aqui — os
// argumentos cruzam a ponte como parâmetros posicionais simples.

// ===== Organização no documento =====
//
// Tudo do AutoGrids vive numa camada só ("AutoGrids"), com UM grupo por
// prancheta. O grupo leva o nome da prancheta (só para o painel Camadas ficar
// legível) e, em .note, os parâmetros usados + o deslocamento entre os limites
// do grupo e os da prancheta no momento em que a grade foi gerada.
//
// O vínculo grupo <-> prancheta NÃO depende do nome nem do número da prancheta
// (os dois mudam: renomear, reordenar, apagar outra prancheta antes dela). Ele
// vem da posição: a grade pertence à prancheta sobre a qual ela está. Os
// limites do grupo + o deslocamento gravado dão o retângulo "esperado" da
// prancheta, e a prancheta com maior sobreposição (IoU >= 0,5) é a dona — isso
// sobrevive a renomear, reordenar e mover a prancheta levando a arte junto.
// Plano B, para quando a prancheta foi movida SEM a arte: o nome do grupo (o
// último nome sincronizado da prancheta).
//
// Guias e pontos convivem na mesma camada: guias não imprimem por natureza, e
// os pontos (objetos reais) imprimem normalmente. A camada fica travada entre
// uma aplicação e outra para ninguém arrastar nada sem querer.

var LAYER_NAME = "AutoGrids";
var META_PREFIX = "ag2";
var LEGACY_GUIDE_LAYER = "AutoGrids Guides";
var LEGACY_DOTS_LAYER = "AutoGrids Pontos";
var DOT_TYPES = { "four-dots": 1, "three-dots": 1 };
var EPS = 0.001;

// ===== Geometria compartilhada =====

function getArtboardBounds(doc, artboardIndex) {
    var r = doc.artboards[artboardIndex].artboardRect;
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

// Recorte de Liang-Barsky: intersecta a reta P0 + t*dir com o retângulo b.
// Sem tLo/tHi a reta é infinita; com (0, 1) vira o segmento P0 -> P0 + dir.
function clipLineToRect(x0, y0, dx, dy, b, tLo, tHi) {
    var tmin = tLo === undefined ? -Infinity : tLo;
    var tmax = tHi === undefined ? Infinity : tHi;
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

// Bordas das células ao longo de um eixo, partindo de "from" e andando no
// sentido "dir" (+1 ou -1) até "to". Sem gutter, cada borda é compartilhada por
// duas células vizinhas (uma linha só); com gutter, cada célula tem as suas
// duas bordas e o gutter fica entre elas.
function cellEdges(from, to, dir, cell, gutter) {
    var out = [];
    var span = Math.abs(to - from) + EPS;
    var s;
    if (gutter > 0) {
        for (s = 0; s <= span; s += cell + gutter) {
            out.push(from + dir * s);
            if (s + cell <= span) out.push(from + dir * (s + cell));
        }
    } else {
        for (s = 0; s <= span; s += cell) out.push(from + dir * s);
    }
    return out;
}

// [left, top, right, bottom] — mesma ordem de artboardRect/geometricBounds.
function rectOfArtboard(doc, i) {
    var r = doc.artboards[i].artboardRect;
    return [r[0], r[1], r[2], r[3]];
}

// Interseção sobre união de dois retângulos [l, t, r, b] (t > b no Illustrator).
function overlapScore(a, b) {
    var iw = Math.min(a[2], b[2]) - Math.max(a[0], b[0]);
    var ih = Math.min(a[1], b[1]) - Math.max(a[3], b[3]);
    if (iw <= 0 || ih <= 0) return 0;
    var inter = iw * ih;
    var areaA = (a[2] - a[0]) * (a[1] - a[3]);
    var areaB = (b[2] - b[0]) * (b[1] - b[3]);
    return inter / (areaA + areaB - inter);
}

// ===== Metadados (.note do grupo) =====
//
// "ag2,type,cell,margin,dot,opacity,gray,gutter,offL,offT,offR,offB"
// Separador "," (não "|"): AutoGrids_getArtboardState já usa "|" entre os
// SEUS campos e devolve parte desta nota como um deles.

function encodeMeta(p, offsets) {
    return [META_PREFIX, p.type, p.cell, p.margin, p.dot, p.opacity, p.gray, p.gutter]
        .concat(offsets).join(",");
}

function parseMeta(note) {
    var f = String(note || "").split(",");
    if (f[0] !== META_PREFIX || f.length < 12) return null;
    return {
        type: f[1],
        cell: parseFloat(f[2]),
        margin: parseFloat(f[3]),
        dot: parseFloat(f[4]),
        opacity: parseFloat(f[5]),
        gray: parseFloat(f[6]),
        gutter: parseFloat(f[7]) || 0,
        off: [parseFloat(f[8]), parseFloat(f[9]), parseFloat(f[10]), parseFloat(f[11])]
    };
}

// Só os parâmetros que o painel usa para recarregar os controles.
function panelMeta(m) {
    return [m.type, m.cell, m.margin, m.dot, m.opacity, m.gray, m.gutter].join(",");
}

// ===== Camada e vínculo grupo <-> prancheta =====

function findLayer(doc) {
    try {
        return doc.layers.getByName(LAYER_NAME);
    } catch (e) {
        return null;
    }
}

function getOrCreateLayer(doc) {
    var layer = findLayer(doc);
    if (!layer) {
        layer = doc.layers.add();
        layer.name = LAYER_NAME;
    }
    layer.locked = false;
    layer.visible = true;
    return layer;
}

// Devolve map[indiceDaPrancheta] = { group, meta } para as pranchetas que têm
// grade. Ver o comentário do topo para a regra de vínculo.
function resolveGroups(doc, layer) {
    var map = [];
    if (!layer) return map;
    var count = doc.artboards.length;
    var rects = [];
    var score = [];
    var orphans = [];
    var i;
    for (i = 0; i < count; i++) rects.push(rectOfArtboard(doc, i));

    for (var gi = 0; gi < layer.groupItems.length; gi++) {
        var g = layer.groupItems[gi];
        var meta = parseMeta(g.note);
        if (!meta) continue;
        var gb = g.geometricBounds;
        var expected = [gb[0] + meta.off[0], gb[1] + meta.off[1], gb[2] + meta.off[2], gb[3] + meta.off[3]];
        var best = -1, bestScore = 0;
        for (i = 0; i < count; i++) {
            var s = overlapScore(expected, rects[i]);
            if (s > bestScore) { bestScore = s; best = i; }
        }
        var entry = { group: g, meta: meta };
        if (best >= 0 && bestScore >= 0.5 && (!map[best] || bestScore > score[best])) {
            if (map[best]) orphans.push(map[best]);
            map[best] = entry;
            score[best] = bestScore;
        } else {
            orphans.push(entry);
        }
    }

    for (var oi = 0; oi < orphans.length; oi++) {
        for (i = 0; i < count; i++) {
            if (!map[i] && doc.artboards[i].name === orphans[oi].group.name) {
                map[i] = orphans[oi];
                break;
            }
        }
    }
    return map;
}

// Grupo de UMA prancheta. Caminho rápido (é o que roda no polling do painel a
// cada 600 ms): olha só os grupos com o nome dessa prancheta e confere a
// posição; só cai na resolução completa se esse atalho não achar nada.
function findGroupFor(doc, layer, artboardIndex) {
    if (!layer) return null;
    var name = doc.artboards[artboardIndex].name;
    var rect = rectOfArtboard(doc, artboardIndex);
    for (var gi = 0; gi < layer.groupItems.length; gi++) {
        var g = layer.groupItems[gi];
        if (g.name !== name) continue;
        var meta = parseMeta(g.note);
        if (!meta) continue;
        var gb = g.geometricBounds;
        var expected = [gb[0] + meta.off[0], gb[1] + meta.off[1], gb[2] + meta.off[2], gb[3] + meta.off[3]];
        if (overlapScore(expected, rect) >= 0.5) return { group: g, meta: meta };
    }
    return resolveGroups(doc, layer)[artboardIndex] || null;
}

// ===== Guias (não imprimem: .guides = true) =====

function addGuideLine(group, x1, y1, x2, y2) {
    var line = group.pathItems.add();
    line.setEntirePath([[x1, y1], [x2, y2]]);
    line.stroked = false;
    line.filled = false;
    line.guides = true;
}

function buildRectangularGuides(group, b, cell, gutter) {
    var xs = cellEdges(b.left, b.right, 1, cell, gutter);
    var ys = cellEdges(b.top, b.bottom, -1, cell, gutter);
    var i;
    for (i = 0; i < xs.length; i++) addGuideLine(group, xs[i], b.bottom, xs[i], b.top);
    for (i = 0; i < ys.length; i++) addGuideLine(group, b.left, ys[i], b.right, ys[i]);
}

function buildRuledGuides(group, b, cell, gutter) {
    var ys = cellEdges(b.top, b.bottom, -1, cell, gutter);
    for (var i = 0; i < ys.length; i++) addGuideLine(group, b.left, ys[i], b.right, ys[i]);
}

// Família de retas paralelas ao ângulo dado, uma a cada "pitch" (medido na
// perpendicular), centradas em b e recortadas nos limites de b. Com gutter,
// cada reta vira um par afastado de ±gutter/2.
function buildLineFamily(group, b, angleDeg, pitch, gutter) {
    var rad = angleDeg * Math.PI / 180;
    var dx = Math.cos(rad), dy = Math.sin(rad);
    if (Math.abs(dx) < 1e-9) dx = 0;
    if (Math.abs(dy) < 1e-9) dy = 0;
    var nx = -dy, ny = dx;
    var cx = (b.left + b.right) / 2, cy = (b.bottom + b.top) / 2;
    var diag = Math.sqrt(Math.pow(b.right - b.left, 2) + Math.pow(b.top - b.bottom, 2));
    var kMax = Math.ceil(diag / pitch) + 1;
    var offsets = gutter > 0 ? [-gutter / 2, gutter / 2] : [0];
    for (var k = -kMax; k <= kMax; k++) {
        for (var oi = 0; oi < offsets.length; oi++) {
            var d = k * pitch + offsets[oi];
            var seg = clipLineToRect(cx + d * nx, cy + d * ny, dx, dy, b);
            if (seg) addGuideLine(group, seg.x1, seg.y1, seg.x2, seg.y2);
        }
    }
}

// "cell" = altura do triângulo (distância entre paralelas). Com gutter, cada
// reta da malha vira um par e cada triângulo encolhe gutter/2 em cada um dos 3
// lados — a altura cai 1,5 × gutter. Por isso a malha anda cell + 1,5 × gutter:
// o triângulo continua com a altura pedida e o vão entre vizinhos é o gutter.
function buildIsometricGuides(group, b, cell, gutter) {
    var pitch = gutter > 0 ? cell + 1.5 * gutter : cell;
    buildLineFamily(group, b, 90, pitch, gutter);
    buildLineFamily(group, b, 30, pitch, gutter);
    buildLineFamily(group, b, 150, pitch, gutter);
}

// Hexágono "pointy-top". Inteiro dentro da área: UM path fechado (6x menos
// objetos que 6 retas soltas). Na borda: só os pedaços das arestas que caem
// dentro da área — sem isso a grade vazava para fora da prancheta e cobria
// parte da prancheta vizinha.
function addHexGuide(group, cx, cy, r, b) {
    var pts = [];
    var inside = true;
    for (var i = 0; i < 6; i++) {
        var ang = (60 * i - 30) * Math.PI / 180;
        var x = cx + r * Math.cos(ang), y = cy + r * Math.sin(ang);
        if (x < b.left - EPS || x > b.right + EPS || y < b.bottom - EPS || y > b.top + EPS) inside = false;
        pts.push([x, y]);
    }
    if (inside) {
        var hex = group.pathItems.add();
        hex.setEntirePath(pts);
        hex.closed = true;
        hex.stroked = false;
        hex.filled = false;
        hex.guides = true;
        return;
    }
    for (var e = 0; e < 6; e++) {
        var a = pts[e], c = pts[(e + 1) % 6];
        var seg = clipLineToRect(a[0], a[1], c[0] - a[0], c[1] - a[1], b, 0, 1);
        if (seg && Math.abs(seg.x2 - seg.x1) + Math.abs(seg.y2 - seg.y1) > EPS) {
            addGuideLine(group, seg.x1, seg.y1, seg.x2, seg.y2);
        }
    }
}

// "size" = raio (centro ao vértice). Com gutter, os centros se afastam para
// que entre arestas paralelas de vizinhos sobre exatamente "gutter". O
// primeiro hexágono fica centrado no canto superior esquerdo da área.
function buildHexGuides(group, b, size, gutter) {
    var r = size;
    var halfW = r * Math.sqrt(3) / 2;
    var hSpacing = r * Math.sqrt(3) + gutter;
    var vSpacing = hSpacing * Math.sqrt(3) / 2;
    var row = 0;
    for (var cy = b.top; cy >= b.bottom - r; cy -= vSpacing) {
        var offset = (row % 2 === 0) ? 0 : hSpacing / 2;
        for (var cx = b.left + offset - hSpacing; cx <= b.right + halfW; cx += hSpacing) {
            if (cx + halfW < b.left) continue;
            addHexGuide(group, cx, cy, r, b);
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
function addDot(group, cx, cy, diameter, opacityPct, grayPct) {
    var r = diameter / 2;
    var k = r * BEZIER_K;
    // Pontos em ordem ao redor do círculo (direita, cima, esquerda, baixo) —
    // NÃO pular de um lado a outro, senão o path se autointersecta.
    var dot = group.pathItems.add();
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
}

function buildSquareDots(group, b, spacing, diameter, opacityPct, grayPct) {
    for (var y = b.top; y >= b.bottom - EPS; y -= spacing) {
        for (var x = b.left; x <= b.right + EPS; x += spacing) {
            addDot(group, x, y, diameter, opacityPct, grayPct);
        }
    }
}

function buildTriangularDots(group, b, spacing, diameter, opacityPct, grayPct) {
    var vSpacing = spacing * Math.sqrt(3) / 2;
    var row = 0;
    for (var y = b.top; y >= b.bottom - EPS; y -= vSpacing) {
        var offset = (row % 2 === 0) ? 0 : spacing / 2;
        for (var x = b.left + offset; x <= b.right + EPS; x += spacing) {
            addDot(group, x, y, diameter, opacityPct, grayPct);
        }
        row++;
    }
}

// ===== Orçamento de objetos =====
//
// O peso não está na conta (é aritmética trivial), está em quantos objetos o
// Illustrator precisa criar — tudo na thread principal dele, e cada aplicação
// ainda vira um passo de desfazer com a grade anterior inteira guardada. Sem
// teto, pontos de 5 pt numa A4 seriam ~20 mil círculos (~7 s travado num PC
// bom, muito mais num fraco), e arrastar o slider empilharia isso no histórico.
// Por isso a grade é estimada ANTES de mexer em qualquer coisa:
//   - acima de LIVE_BUDGET, não redesenha durante o arraste (só ao soltar);
//   - acima de HARD_BUDGET, não aplica (a grade atual fica como está).
// Custo medido por objeto (Illustrator 2026, Windows): guia reta ~0,07 ms,
// hexágono ~0,14 ms, ponto ~0,5 ms (2.580 pontos = 1,4 s) — daí os pesos
// 1 / 2 / 7. Os tetos dão ~140 ms por atualização ao vivo e ~2 s no pior caso
// aqui (3-4x isso num PC fraco).
var COST_WEIGHT = { line: 1, hex: 2, dot: 7 };
var LIVE_BUDGET = 2000;
var HARD_BUDGET = 30000;

function edgeCount(span, cell, gutter) {
    if (gutter > 0) return 2 * (Math.floor(span / (cell + gutter)) + 1);
    return Math.floor(span / cell) + 1;
}

// Estimativa (levemente por cima) de quantos objetos a grade vai ter.
function estimateObjects(p, b) {
    var w = b.right - b.left, h = b.top - b.bottom;
    var n, weight = COST_WEIGHT.line;
    if (p.type === "rectangle") {
        n = edgeCount(w, p.cell, p.gutter) + edgeCount(h, p.cell, p.gutter);
    } else if (p.type === "lines") {
        n = edgeCount(h, p.cell, p.gutter);
    } else if (p.type === "triangle") {
        var pitch = p.gutter > 0 ? p.cell + 1.5 * p.gutter : p.cell;
        var pairs = p.gutter > 0 ? 2 : 1;
        // largura da prancheta medida na perpendicular de cada família (90°, 30°, 150°)
        var extents = [w, w * 0.5 + h * Math.sqrt(3) / 2, w * 0.5 + h * Math.sqrt(3) / 2];
        n = 0;
        for (var i = 0; i < 3; i++) n += (Math.floor(extents[i] / pitch) + 1) * pairs;
    } else if (p.type === "hexagon") {
        var hS = p.cell * Math.sqrt(3) + p.gutter, vS = hS * Math.sqrt(3) / 2;
        var cols = Math.floor(w / hS) + 2, rows = Math.floor((h + p.cell) / vS) + 1;
        // hexágonos inteiros (1 path cada) + os da borda, cortados em até ~4 retas
        var border = Math.min(cols * rows, 2 * (cols + rows));
        var whole = cols * rows - border;
        return { count: whole + border * 4, cost: whole * COST_WEIGHT.hex + border * 4 * COST_WEIGHT.line };
    } else {
        var rowStep = p.type === "three-dots" ? p.cell * Math.sqrt(3) / 2 : p.cell;
        n = (Math.floor(w / p.cell) + 1) * (Math.floor(h / rowStep) + 1);
        weight = COST_WEIGHT.dot;
    }
    return { count: n, cost: n * weight };
}

// ===== Geração =====

function validateParams(doc, artboardIndex, p) {
    if (!(p.cell > 0)) return "ERRO: Tamanho de célula inválido.";
    if (!boundsValid(insetBounds(getArtboardBounds(doc, artboardIndex), p.margin))) {
        return "ERRO: A margem é maior que a prancheta ativa.";
    }
    if (!DOT_TYPES[p.type] && p.type !== "rectangle" && p.type !== "triangle" &&
        p.type !== "lines" && p.type !== "hexagon") {
        return "ERRO: tipo de grade desconhecido: " + p.type;
    }
    return "";
}

// Cria o grupo da prancheta já com a grade dentro (camada precisa estar
// destravada). Quem chama remove o grupo anterior antes.
function buildGrid(doc, layer, artboardIndex, p) {
    var b = insetBounds(getArtboardBounds(doc, artboardIndex), p.margin);
    var group = layer.groupItems.add();
    if (p.type === "rectangle") buildRectangularGuides(group, b, p.cell, p.gutter);
    else if (p.type === "triangle") buildIsometricGuides(group, b, p.cell, p.gutter);
    else if (p.type === "lines") buildRuledGuides(group, b, p.cell, p.gutter);
    else if (p.type === "hexagon") buildHexGuides(group, b, p.cell, p.gutter);
    else if (p.type === "four-dots") buildSquareDots(group, b, p.cell, p.dot, p.opacity, p.gray);
    else buildTriangularDots(group, b, p.cell, p.dot, p.opacity, p.gray);

    var gb = group.geometricBounds;
    var ab = rectOfArtboard(doc, artboardIndex);
    group.note = encodeMeta(p, [ab[0] - gb[0], ab[1] - gb[1], ab[2] - gb[2], ab[3] - gb[3]]);
    group.name = doc.artboards[artboardIndex].name;
    return group;
}

// Documentos feitos com a versão anterior (duas camadas, objetos marcados com
// o índice da prancheta): regera cada grade no formato novo a partir dos
// parâmetros que ela gravou e apaga as camadas antigas. Só age se elas existirem.
function migrateLegacy(doc) {
    var legacy = [];
    try { legacy.push(doc.layers.getByName(LEGACY_GUIDE_LAYER)); } catch (e1) { /* não existe */ }
    try { legacy.push(doc.layers.getByName(LEGACY_DOTS_LAYER)); } catch (e2) { /* não existe */ }
    if (legacy.length === 0) return;

    var params = [];
    var li, k;
    for (li = 0; li < legacy.length; li++) {
        var items = legacy[li].pageItems;
        for (k = 0; k < items.length; k++) {
            var m = /^AutoGrids:ab(\d+):meta$/.exec(items[k].name);
            if (!m) continue;
            var f = String(items[k].note).split(",");
            if (f.length < 6) continue;
            params[parseInt(m[1], 10)] = {
                type: f[0], cell: parseFloat(f[1]), margin: parseFloat(f[2]), dot: parseFloat(f[3]),
                opacity: parseFloat(f[4]), gray: parseFloat(f[5]), gutter: 0
            };
        }
    }
    for (li = 0; li < legacy.length; li++) {
        legacy[li].locked = false;
        legacy[li].remove();
    }

    var layer = null;
    for (var i = 0; i < params.length && i < doc.artboards.length; i++) {
        if (!params[i] || validateParams(doc, i, params[i])) continue;
        if (!layer) layer = getOrCreateLayer(doc);
        buildGrid(doc, layer, i, params[i]);
    }
    if (layer) layer.locked = true;
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

// Retorna "1|índice|totalDePranchetas|larguraPt|alturaPt|meta|documento|nome"
// (ou "0" sem documento). "meta" é panelMeta() da grade dessa prancheta, ou ""
// se ela ainda não tem grade. "documento" deixa o painel perceber a troca de
// documento mesmo quando a prancheta ativa tem o mesmo número nos dois. Nos
// nomes, o "|" é trocado por "/" só por garantia. Chamado na abertura do painel
// e em polling — o CEP do Illustrator não tem evento de troca de prancheta.
function AutoGrids_getArtboardState() {
    try {
        if (app.documents.length === 0) return "0";
        var doc = app.activeDocument;
        migrateLegacy(doc);
        var i = doc.artboards.getActiveArtboardIndex();
        var b = getArtboardBounds(doc, i);
        var entry = findGroupFor(doc, findLayer(doc), i);
        var meta = entry ? panelMeta(entry.meta) : "";
        var name = String(doc.artboards[i].name).replace(/\|/g, "/");
        var docName = String(doc.name).replace(/\|/g, "/");
        return ["1", i, doc.artboards.length, b.right - b.left, b.top - b.bottom, meta, docName, name].join("|");
    } catch (err) {
        return "0";
    }
}

// Renomeia cada grupo com o nome ATUAL da sua prancheta. Não roda no polling
// (cada renomeação vira um passo de desfazer, e brigaria com o Ctrl+Z de quem
// acabou de renomear a prancheta) — o painel chama ao abrir e ao trocar de
// prancheta, e cada aplicação já nomeia o grupo que criou.
function AutoGrids_syncNames() {
    try {
        if (app.documents.length === 0) return "OK";
        var doc = app.activeDocument;
        var layer = findLayer(doc);
        if (!layer) return "OK";
        var map = resolveGroups(doc, layer);
        var renamed = 0;
        for (var i = 0; i < map.length; i++) {
            if (map[i] && map[i].group.name !== doc.artboards[i].name) {
                map[i].group.name = doc.artboards[i].name;
                renamed++;
            }
        }
        return "OK|" + renamed;
    } catch (err) {
        return "ERRO: " + err.message;
    }
}

// Aplica SEMPRE na prancheta ativa no momento da chamada — substitui só o
// grupo dessa prancheta (guias e pontos são mutuamente exclusivos por prancheta
// porque cada prancheta tem um grupo só).
//
// "live" = chamada no meio de um arraste de slider. Aí pulamos o app.redraw():
// medido, gerar a grade leva ~7 ms e o redraw forçado ~100 ms — era ele que
// limitava a taxa de atualização. Ao soltar o slider o painel manda uma última
// chamada sem "live", que força o redesenho final.
function AutoGrids_apply(type, cellSize, margin, dotSize, opacityPct, grayPct, gutter, live) {
    try {
        if (app.documents.length === 0) return "ERRO: Abra um documento no Illustrator.";
        var doc = app.activeDocument;
        migrateLegacy(doc);
        var i = doc.artboards.getActiveArtboardIndex();
        var p = {
            type: type, cell: cellSize, margin: margin, dot: dotSize,
            opacity: opacityPct, gray: grayPct, gutter: (gutter > 0 && !DOT_TYPES[type]) ? gutter : 0
        };
        var invalid = validateParams(doc, i, p);
        if (invalid) return invalid;

        // Antes de mexer em qualquer coisa: a grade atual só é trocada se a
        // nova couber no orçamento (ver "Orçamento de objetos").
        var est = estimateObjects(p, insetBounds(getArtboardBounds(doc, i), p.margin));
        if (est.cost > HARD_BUDGET) {
            return "ERRO: Grade densa demais para esta prancheta (cerca de " + est.count +
                " objetos). Aumente o tamanho da célula" + (DOT_TYPES[type] ? "" : " ou o gutter") + ".";
        }
        if (live && est.cost > LIVE_BUDGET) return "DENSO|" + est.count;

        var layer = getOrCreateLayer(doc);
        var current = findGroupFor(doc, layer, i);
        if (current) current.group.remove();
        buildGrid(doc, layer, i, p);
        layer.locked = true;
        if (!live) app.redraw();
        return "OK";
    } catch (err) {
        return "ERRO: " + err.message + " (line " + err.line + ")";
    }
}

function removeActiveGroup(onlyDots) {
    if (app.documents.length === 0) return;
    var doc = app.activeDocument;
    var layer = findLayer(doc);
    if (!layer) return;
    var entry = findGroupFor(doc, layer, doc.artboards.getActiveArtboardIndex());
    if (!entry || (onlyDots && !DOT_TYPES[entry.meta.type])) return;
    var wasLocked = layer.locked;
    layer.locked = false;
    entry.group.remove();
    layer.locked = wasLocked;
    app.redraw();
}

// Chamado quando o painel sai da aba "Pontos" — evita que um preview de pontos
// (objetos reais, imprimíveis) da prancheta ativa fique esquecido.
function AutoGrids_clearDotsOnly() {
    try {
        removeActiveGroup(true);
        return "OK";
    } catch (e) {
        return "OK";
    }
}

// Botão "Limpar prancheta": remove a grade só da prancheta ativa no momento.
function AutoGrids_clear() {
    try {
        removeActiveGroup(false);
        return "OK";
    } catch (err) {
        return "ERRO: " + err.message;
    }
}

// Remove o AutoGrids de TODAS as pranchetas do documento (ação explícita, sem
// atalho no painel por padrão — reservado para quando quiser mesmo zerar tudo).
function AutoGrids_clearAll() {
    try {
        if (app.documents.length === 0) return "OK";
        var doc = app.activeDocument;
        var names = [LAYER_NAME, LEGACY_GUIDE_LAYER, LEGACY_DOTS_LAYER];
        for (var i = 0; i < names.length; i++) {
            try {
                var layer = doc.layers.getByName(names[i]);
                layer.locked = false;
                layer.remove();
            } catch (e) { /* não existe */ }
        }
        app.redraw();
        return "OK";
    } catch (err) {
        return "ERRO: " + err.message;
    }
}

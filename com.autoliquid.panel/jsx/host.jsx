// AutoLiquid — motor ExtendScript chamado pelo painel CEP via evalScript.
// Convenção: todas as entradas numéricas chegam em pontos (pt), sem JSON —
// os argumentos cruzam a ponte como parâmetros posicionais simples (mesma
// convenção do AutoGrids, projeto irmão neste repositório).
//
// ===== Líquido (ponte "metaball" entre 2 formas selecionadas) =====
//
// Aproxima cada forma selecionada por uma elipse inscrita no seu retângulo
// delimitador (geometricBounds) e calcula, entre as duas, uma ponte com 2
// curvas bezier + 2 segmentos retos que ficam por baixo das formas originais
// (portanto invisíveis, cobertos pelas próprias formas). O parâmetro v
// (0..1, vindo do slider "Pregnância") interpola cada ponto de tangência
// entre o ângulo de interseção real das elipses (v=0 — quando as formas não
// se sobrepõem, os dois pontos de cada lado coincidem e a ponte fica com
// área ~0, ou seja, invisível) e o ângulo da tangente externa comum às duas
// elipses (v=1 — ponte "esticada ao máximo", lados retos, como uma correia
// entre duas polias). A "cintura" da ponte afina pra dentro porque os
// handles bezier seguem a direção tangente de cada elipse no ponto de
// contato — mesma ideia de leftDirection/rightDirection manual usada no
// AutoGrids (função addDot lá), só que com handles derivados da geometria
// em vez de uma constante fixa tipo BEZIER_K.
//
// Funciona bem com círculos, elipses e retângulos bem arredondados. Como a
// aproximação usa a elipse INSCRITA no bounding box, retângulos de cantos
// vivos ou pouco arredondados podem deixar uma pequena folga entre a ponte
// e o canto real da forma (limitação conhecida da v1).

var LIQUID_LAYER_NAME = "AutoGrids Líquido";
var LIQUID_HANDLE_K = 0.5;

function clampNum(v, lo, hi) {
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
}

// Raio da elipse (hw,hh) na direção "angle" a partir do próprio centro.
function ellipseRadiusAt(hw, hh, angle) {
    var c = Math.cos(angle), s = Math.sin(angle);
    var denom = Math.sqrt(hh * hh * c * c + hw * hw * s * s);
    return (hw * hh) / denom;
}

function ellipsePointAt(shape, angle) {
    var r = ellipseRadiusAt(shape.hw, shape.hh, angle);
    return { x: shape.cx + r * Math.cos(angle), y: shape.cy + r * Math.sin(angle) };
}

// Direção tangente (não orientada, comprimento 1) à elipse no ângulo "angle".
function ellipseTangentAt(shape, angle) {
    var r = ellipseRadiusAt(shape.hw, shape.hh, angle);
    var px = r * Math.cos(angle), py = r * Math.sin(angle);
    var tx = -py / (shape.hh * shape.hh);
    var ty = px / (shape.hw * shape.hw);
    var len = Math.sqrt(tx * tx + ty * ty);
    if (len < 1e-9) return { x: 1, y: 0 };
    return { x: tx / len, y: ty / len };
}

// Orienta "t" pra apontar no mesmo sentido de (dirX,dirY). Os dois handles
// de um mesmo trecho de curva (ponta de saída e ponta de chegada) precisam
// apontar no MESMO sentido de percurso — não um pro outro — senão a curva
// sai com a concavidade invertida (bojo pra fora em vez de cintura pra
// dentro). Ver verificação numérica feita antes de portar essa lógica.
function orientForward(t, dirX, dirY) {
    var dot = t.x * dirX + t.y * dirY;
    if (dot < 0) return { x: -t.x, y: -t.y };
    return { x: t.x, y: t.y };
}

function ptDist(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// Calcula os 4 pontos de tangência + handles bezier da ponte entre s1 e s2.
// Retorna null se os centros forem (quase) coincidentes (caso degenerado).
function computeLiquidBridge(s1, s2, v) {
    var dx = s2.cx - s1.cx, dy = s2.cy - s1.cy;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1e-6) return null;
    var theta = Math.atan2(dy, dx);

    var r1 = ellipseRadiusAt(s1.hw, s1.hh, theta);
    var r2 = ellipseRadiusAt(s2.hw, s2.hh, theta + Math.PI);

    var beta = Math.acos(clampNum((r1 - r2) / d, -1, 1));

    var u1 = 0, u2 = 0;
    if (d < r1 + r2) {
        u1 = Math.acos(clampNum((r1 * r1 + d * d - r2 * r2) / (2 * r1 * d), -1, 1));
        u2 = Math.acos(clampNum((r2 * r2 + d * d - r1 * r1) / (2 * r2 * d), -1, 1));
    }

    var angle1 = theta + (1 - v) * u1 + v * beta;
    var angle2 = theta - (1 - v) * u1 - v * beta;
    var angle3 = theta + (1 - v) * (Math.PI - u2) + v * beta;
    var angle4 = theta - (1 - v) * (Math.PI - u2) - v * beta;

    var P1 = ellipsePointAt(s1, angle1);
    var P2 = ellipsePointAt(s1, angle2);
    var P3 = ellipsePointAt(s2, angle3);
    var P4 = ellipsePointAt(s2, angle4);

    var h13 = LIQUID_HANDLE_K * ptDist(P1, P3);
    var h24 = LIQUID_HANDLE_K * ptDist(P2, P4);

    var t1 = orientForward(ellipseTangentAt(s1, angle1), P3.x - P1.x, P3.y - P1.y);
    var t3 = orientForward(ellipseTangentAt(s2, angle3), P3.x - P1.x, P3.y - P1.y);
    var t4 = orientForward(ellipseTangentAt(s2, angle4), P2.x - P4.x, P2.y - P4.y);
    var t2 = orientForward(ellipseTangentAt(s1, angle2), P2.x - P4.x, P2.y - P4.y);

    return {
        P1: P1, P2: P2, P3: P3, P4: P4,
        H_P1out: { x: P1.x + t1.x * h13, y: P1.y + t1.y * h13 },
        H_P3in: { x: P3.x - t3.x * h13, y: P3.y - t3.y * h13 },
        H_P4out: { x: P4.x + t4.x * h24, y: P4.y + t4.y * h24 },
        H_P2in: { x: P2.x - t2.x * h24, y: P2.y - t2.y * h24 }
    };
}

function getOrCreateLiquidLayer(doc) {
    var layer;
    try {
        layer = doc.layers.getByName(LIQUID_LAYER_NAME);
    } catch (e) {
        layer = doc.layers.add();
        layer.name = LIQUID_LAYER_NAME;
        layer.move(doc, ElementPlacement.PLACEATEND); // fica abaixo das outras camadas
    }
    layer.locked = false;
    layer.visible = true;
    return layer;
}

function clearLiquidTagged(layer, tag) {
    for (var i = layer.pageItems.length - 1; i >= 0; i--) {
        var item = layer.pageItems[i];
        if (item.name === tag) item.remove();
    }
}

// item.geometricBounds pode vir em qualquer ordem de sinal dependendo da
// forma/transform; normalizamos com min/max (mesma defesa que o AutoGrids
// usa pro artboardRect em getArtboardBounds).
function shapeFromPageItem(item) {
    var gb = item.geometricBounds; // [left, top, right, bottom]
    var left = Math.min(gb[0], gb[2]), right = Math.max(gb[0], gb[2]);
    var bottom = Math.min(gb[1], gb[3]), top = Math.max(gb[1], gb[3]);
    return {
        cx: (left + right) / 2,
        cy: (bottom + top) / 2,
        hw: (right - left) / 2,
        hh: (top - bottom) / 2
    };
}

// Extrai uma cor RGB aproximada pra usar como preenchimento padrão da ponte
// (a mesma da 1ª forma selecionada). Formas sem preenchimento sólido simples
// (gradiente, padrão, spot) caem num cinza médio neutro.
function approxFillRGB(item) {
    try {
        if (!item.filled) return { r: 128, g: 128, b: 128 };
        var c = item.fillColor;
        if (c.typename === "RGBColor") {
            return { r: Math.round(c.red), g: Math.round(c.green), b: Math.round(c.blue) };
        }
        if (c.typename === "GrayColor") {
            var g = Math.round(255 * (1 - c.gray / 100));
            return { r: g, g: g, b: g };
        }
        if (c.typename === "CMYKColor") {
            var r = Math.round(255 * (1 - c.cyan / 100) * (1 - c.black / 100));
            var gg = Math.round(255 * (1 - c.magenta / 100) * (1 - c.black / 100));
            var b = Math.round(255 * (1 - c.yellow / 100) * (1 - c.black / 100));
            return { r: r, g: gg, b: b };
        }
        return { r: 128, g: 128, b: 128 };
    } catch (e) {
        return { r: 128, g: 128, b: 128 };
    }
}

function eligibleLiquidShape(item) {
    return item.typename === "PathItem";
}

// ===== Pontos de entrada chamados pelo painel =====

// Lê a seleção atual e devolve a geometria (centro/meio-eixos) + cor de
// preenchimento da 1ª forma, pro painel guardar localmente. A ponte usa
// essa posição "congelada" no momento da captura — se as formas forem
// movidas depois, é preciso capturar de novo (ver AutoLiquid_apply).
function AutoLiquid_captureSelection() {
    try {
        if (app.documents.length === 0) return "ERRO: Abra um documento no Illustrator.";
        var sel = app.selection;
        if (!sel || sel.length !== 2) {
            return "ERRO: Selecione exatamente 2 formas (você selecionou " + (sel ? sel.length : 0) + ").";
        }
        if (!eligibleLiquidShape(sel[0]) || !eligibleLiquidShape(sel[1])) {
            return "ERRO: Selecione 2 formas simples (retângulo/elipse) — grupos, texto e compound paths ainda não são suportados.";
        }
        var s1 = shapeFromPageItem(sel[0]);
        var s2 = shapeFromPageItem(sel[1]);
        if (!(s1.hw > 0.01) || !(s1.hh > 0.01) || !(s2.hw > 0.01) || !(s2.hh > 0.01)) {
            return "ERRO: Uma das formas selecionadas não tem área (é uma linha aberta?).";
        }
        var fill = approxFillRGB(sel[0]);
        return "OK|" + s1.cx + "|" + s1.cy + "|" + s1.hw + "|" + s1.hh + "|" +
            s2.cx + "|" + s2.cy + "|" + s2.hw + "|" + s2.hh + "|" +
            fill.r + "|" + fill.g + "|" + fill.b;
    } catch (err) {
        return "ERRO: " + err.message + " (line " + err.line + ")";
    }
}

// Desenha/atualiza a ponte líquida identificada por "tag" (gerada no painel,
// uma por conexão) usando a geometria capturada e a força atual do slider.
// Sempre redesenha do zero (remove a versão anterior com a mesma tag) — mesmo
// padrão de "recriar tudo a cada mudança" já usado no AutoGrids.
function AutoLiquid_apply(tag, s1cx, s1cy, s1hw, s1hh, s2cx, s2cy, s2hw, s2hh, strengthPct, fillR, fillG, fillB) {
    try {
        if (app.documents.length === 0) return "ERRO: Abra um documento no Illustrator.";
        var doc = app.activeDocument;
        var layer = getOrCreateLiquidLayer(doc);
        clearLiquidTagged(layer, tag);

        var s1 = { cx: s1cx, cy: s1cy, hw: s1hw, hh: s1hh };
        var s2 = { cx: s2cx, cy: s2cy, hw: s2hw, hh: s2hh };
        var v = clampNum(strengthPct / 100, 0, 1);

        var b = computeLiquidBridge(s1, s2, v);
        if (!b) { app.redraw(); return "OK"; }

        var path = layer.pathItems.add();
        path.setEntirePath([
            [b.P1.x, b.P1.y], [b.P3.x, b.P3.y], [b.P4.x, b.P4.y], [b.P2.x, b.P2.y]
        ]);
        var p = path.pathPoints;
        // P1 -> curva -> P3
        p[0].rightDirection = [b.H_P1out.x, b.H_P1out.y];
        p[0].leftDirection = [b.P1.x, b.P1.y];
        p[1].leftDirection = [b.H_P3in.x, b.H_P3in.y];
        p[1].rightDirection = [b.P3.x, b.P3.y];
        // P3 -> reta -> P4 (some por baixo da forma 2) -> curva -> P2 -> reta -> P1 (fecha por baixo da forma 1)
        p[2].rightDirection = [b.H_P4out.x, b.H_P4out.y];
        p[2].leftDirection = [b.P4.x, b.P4.y];
        p[3].leftDirection = [b.H_P2in.x, b.H_P2in.y];
        p[3].rightDirection = [b.P2.x, b.P2.y];

        path.closed = true;
        path.stroked = false;
        path.filled = true;
        var c = new RGBColor();
        c.red = fillR; c.green = fillG; c.blue = fillB;
        path.fillColor = c;
        path.name = tag;
        path.zOrder(ZOrderMethod.SENDTOBACK);

        app.redraw();
        return "OK";
    } catch (err) {
        return "ERRO: " + err.message + " (line " + err.line + ")";
    }
}

// Remove TODAS as pontes líquidas do documento (botão "Limpar conexões líquidas").
function AutoLiquid_clearAll() {
    try {
        if (app.documents.length === 0) return "OK";
        var doc = app.activeDocument;
        try {
            var layer = doc.layers.getByName(LIQUID_LAYER_NAME);
            for (var i = layer.pageItems.length - 1; i >= 0; i--) layer.pageItems[i].remove();
        } catch (e) { /* ainda não existe */ }
        app.redraw();
        return "OK";
    } catch (err) {
        return "ERRO: " + err.message;
    }
}

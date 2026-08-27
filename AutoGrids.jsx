// AutoGrids — gera guias de grade (retangular ou isométrica) dentro da prancheta ativa.
// Instalar: Arquivo > Scripts > Outro Script..., ou copiar para a pasta Presets/<idioma>/Scripts do Illustrator.
#target illustrator

(function () {
    "use strict";

    var GUIDE_LAYER_NAME = "AutoGrids Guides";

    function getActiveArtboardBounds(doc) {
        var ab = doc.artboards[doc.artboards.getActiveArtboardIndex()];
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

    function getOrCreateGuideLayer(doc) {
        var layer;
        try {
            layer = doc.layers.getByName(GUIDE_LAYER_NAME);
        } catch (e) {
            layer = doc.layers.add();
            layer.name = GUIDE_LAYER_NAME;
        }
        layer.locked = false;
        layer.visible = true;
        return layer;
    }

    function clearLayer(layer) {
        for (var i = layer.pageItems.length - 1; i >= 0; i--) {
            layer.pageItems[i].remove();
        }
    }

    function addGuideLine(layer, x1, y1, x2, y2) {
        var line = layer.pathItems.add();
        line.setEntirePath([[x1, y1], [x2, y2]]);
        line.stroked = false;
        line.filled = false;
        line.guides = true;
        return line;
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

    function buildRectangularGrid(layer, b, cols, rows) {
        var w = b.right - b.left;
        var h = b.top - b.bottom;
        var i, x, y;
        for (i = 0; i <= cols; i++) {
            x = b.left + (w * i / cols);
            addGuideLine(layer, x, b.bottom, x, b.top);
        }
        for (i = 0; i <= rows; i++) {
            y = b.bottom + (h * i / rows);
            addGuideLine(layer, b.left, y, b.right, y);
        }
    }

    // Gera uma família de retas paralelas ao ângulo dado, espaçadas por "spacing"
    // (medido perpendicularmente à direção), centradas em b e recortadas nos limites de b.
    function buildLineFamily(layer, b, angleDeg, spacing) {
        var rad = angleDeg * Math.PI / 180;
        var dx = Math.cos(rad), dy = Math.sin(rad);
        // Math.cos/sin(90°) deixam um resíduo de ponto flutuante em vez de 0 exato,
        // o que quebra o caso especial "paralelo à borda" do recorte de Liang-Barsky.
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
            if (seg) addGuideLine(layer, seg.x1, seg.y1, seg.x2, seg.y2);
        }
    }

    // Grade isométrica clássica: verticais + duas famílias diagonais a 30°/150°,
    // com o mesmo espaçamento perpendicular, formando losangos isométricos.
    function buildIsometricGrid(layer, b, size) {
        buildLineFamily(layer, b, 90, size);
        buildLineFamily(layer, b, 30, size);
        buildLineFamily(layer, b, 150, size);
    }

    function main() {
        if (app.documents.length === 0) {
            alert("Abra um documento no Illustrator antes de rodar o AutoGrids.");
            return;
        }
        // "dialog" (modal), não "palette": nesta instalação do Illustrator, uma paleta
        // modeless com #targetengine reabre sem erro, mas doc.artboards/doc.layers etc.
        // lançam "there is no document" dentro do onClick (mesmo obtendo o doc na hora).
        // Um diálogo modal roda tudo na mesma execução síncrona do script e não sofre disso.
        var win = new Window("dialog", "AutoGrids", undefined);
        win.orientation = "column";
        win.alignChildren = "fill";

        var typeGroup = win.add("group");
        typeGroup.add("statictext", undefined, "Tipo de grade:");
        var typeDropdown = typeGroup.add("dropdownlist", undefined, ["Retangular", "Isométrica"]);
        typeDropdown.selection = 0;

        var marginGroup = win.add("group");
        marginGroup.add("statictext", undefined, "Margem (pt):");
        var marginInput = marginGroup.add("edittext", undefined, "0");
        marginInput.characters = 6;

        var rectPanel = win.add("panel", undefined, "Retangular");
        rectPanel.orientation = "column";
        rectPanel.alignChildren = "fill";
        var colsGroup = rectPanel.add("group");
        colsGroup.add("statictext", undefined, "Colunas:");
        var colsInput = colsGroup.add("edittext", undefined, "6");
        colsInput.characters = 5;
        var rowsGroup = rectPanel.add("group");
        rowsGroup.add("statictext", undefined, "Linhas:");
        var rowsInput = rowsGroup.add("edittext", undefined, "4");
        rowsInput.characters = 5;

        var isoPanel = win.add("panel", undefined, "Isométrica");
        isoPanel.orientation = "column";
        isoPanel.alignChildren = "fill";
        var sizeGroup = isoPanel.add("group");
        sizeGroup.add("statictext", undefined, "Tamanho da célula (pt):");
        var sizeInput = sizeGroup.add("edittext", undefined, "50");
        sizeInput.characters = 5;

        function syncPanels() {
            var isRect = typeDropdown.selection.index === 0;
            rectPanel.visible = isRect;
            isoPanel.visible = !isRect;
        }
        syncPanels();
        typeDropdown.onChange = syncPanels;

        var btnGroup = win.add("group");
        var applyBtn = btnGroup.add("button", undefined, "Aplicar");
        var clearBtn = btnGroup.add("button", undefined, "Limpar grade");
        var closeBtn = btnGroup.add("button", undefined, "Fechar");

        function currentBounds(doc) {
            var raw = getActiveArtboardBounds(doc);
            var margin = parseFloat(marginInput.text);
            if (isNaN(margin) || margin < 0) margin = 0;
            return insetBounds(raw, margin);
        }

        function doApply() {
            try {
                if (app.documents.length === 0) {
                    alert("Abra um documento no Illustrator antes de aplicar a grade.");
                    return;
                }
                var doc = app.documents[0];
                var b = currentBounds(doc);
                if (!boundsValid(b)) {
                    alert("A margem informada é maior que a prancheta ativa.");
                    return;
                }
                var layer = getOrCreateGuideLayer(doc);
                clearLayer(layer);

                if (typeDropdown.selection.index === 0) {
                    var cols = parseInt(colsInput.text, 10);
                    var rows = parseInt(rowsInput.text, 10);
                    if (!(cols > 0) || !(rows > 0)) {
                        alert("Informe colunas e linhas maiores que zero.");
                        return;
                    }
                    buildRectangularGrid(layer, b, cols, rows);
                } else {
                    var size = parseFloat(sizeInput.text);
                    if (!(size > 0)) {
                        alert("Informe um tamanho de célula maior que zero.");
                        return;
                    }
                    buildIsometricGrid(layer, b, size);
                }

                layer.locked = true;
                app.redraw();
            } catch (err) {
                alert("Erro ao gerar a grade: " + err.message);
            }
        }

        function doClear() {
            try {
                if (app.documents.length === 0) return;
                var layer = app.documents[0].layers.getByName(GUIDE_LAYER_NAME);
                layer.locked = false;
                clearLayer(layer);
                app.redraw();
            } catch (e) {
                // ainda não existe camada de guias — nada a limpar
            }
        }

        applyBtn.onClick = doApply;
        clearBtn.onClick = doClear;

        closeBtn.onClick = function () {
            win.close();
        };

        win.show();
    }

    main();
}());

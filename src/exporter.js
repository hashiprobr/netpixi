import * as PIXI from 'pixi.js';

import { pop } from './data';


function exportImage(app, graph, filename) {
    const {
        settings,
        getScale,
        setExporting,
        drawAreas,
    } = graph;

    return new Promise((resolve) => {
        setExporting(true);

        drawAreas();

        const clear = false;

        const bounds = app.stage.getBounds();
        const scale = getScale();

        const width = bounds.width + 2 * scale * settings.graph.hborder;
        const height = bounds.height + 2 * scale * settings.graph.vborder;

        const renderTexture = PIXI.RenderTexture.create({ width, height });

        const graphics = new PIXI.Graphics()
            .beginFill(settings.graph.color, settings.graph.alpha)
            .drawRect(-1, -1, width + 2, height + 2)
            .endFill();
        app.renderer.render(graphics, { renderTexture, clear });
        graphics.destroy();

        const tx = scale * settings.graph.hborder - bounds.x;
        const ty = scale * settings.graph.vborder - bounds.y;
        const transform = new PIXI.Matrix(1, 0, 0, 1, tx, ty);
        app.renderer.render(app.stage, { renderTexture, clear, transform });

        const image = app.renderer.plugins.extract.image(renderTexture, 'image/png', 1);

        renderTexture.destroy();

        const a = document.createElement('a');
        a.setAttribute('href', pop(image, 'src'));
        a.setAttribute('download', `${filename}.png`);
        a.click();
        a.remove();

        setExporting(false);

        resolve();
    });
}


function exportVideo() {
    return new Promise((resolve) => {
        resolve();
    });
}


export { exportImage, exportVideo };

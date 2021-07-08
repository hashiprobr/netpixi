import * as PIXI from 'pixi.js';


function exportImage(filename, app, settings, scale) {
    return new Promise((resolve) => {
        const bounds = app.stage.getBounds();

        const width = bounds.width + 2 * scale * settings.graph.borderX;
        const height = bounds.height + 2 * scale * settings.graph.borderY;

        const texture = PIXI.RenderTexture.create(width, height);

        const graphics = new PIXI.Graphics()
            .beginFill(settings.graph.color, settings.graph.alpha)
            .drawRect(0, 0, width + 1, height + 1)
            .endFill();
        app.renderer.render(graphics, texture, false);

        const tx = scale * settings.graph.borderX - bounds.x;
        const ty = scale * settings.graph.borderY - bounds.y;
        const matrix = new PIXI.Matrix(1, 0, 0, 1, tx, ty);
        app.renderer.render(app.stage, texture, false, matrix);

        const image = app.renderer.plugins.extract.image(texture, 'image/png', 1);

        const a = document.createElement('a');
        a.setAttribute('href', image.src);
        a.setAttribute('download', `${filename}.png`);
        a.click();
        a.remove();

        texture.destroy();

        resolve();
    });
}


function exportVideo() {
    return new Promise((resolve) => {
        resolve();
    });
}


export { exportImage, exportVideo };

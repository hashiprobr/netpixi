import main from './main';
import build from './build';
import Animation from './Animation';
import Panel from './Panel';
import Proxy from './Proxy';


const proxies = {};


function render(uid, path, aspect, normalize, infinite, broker) {
    const { app, cell } = main(uid);

    build(path, aspect, normalize, infinite, broker, app, cell)
        .then((graph) => {
            cell.connectToBody(proxies, uid, graph);

            const animation = Animation();

            const filename = path.slice(path.lastIndexOf('/') + 1);

            const panel = Panel(app, cell, graph, animation, filename);

            graph.connectMouseToSprites(panel);

            graph.connectMouseToView(panel);

            proxies[uid] = Proxy(cell, graph, animation, panel);

            cell.add(panel.top);
            cell.add(panel.middle);
            cell.add(app.view);
            cell.add(panel.bottom);
        })
        .catch((error) => {
            cell.warn(error);
            cell.destroy();
        });
}


function call(localUid, globalUid, name, code) {
    const element = document.getElementById(localUid);
    if (globalUid in proxies) {
        element.parentElement.remove();
        proxies[globalUid](name, code);
    } else {
        element.innerHTML = 'Render not found';
    }
}


export default { proxies, render, call };

import * as ponyfill from 'web-streams-polyfill/ponyfill';
import streamSaver from 'streamsaver';

import { useDeflate } from './zipnet';

if (!streamSaver.WritableStream) {
    streamSaver.WritableStream = ponyfill.WritableStream;
}


export default function (filename, settings, vertices, areas) {
    return new Promise((response) => {
        const stream = streamSaver.createWriteStream(filename);
        const writer = stream.getWriter();

        window.addEventListener('unload', () => {
            writer.abort();
        });

        function process(chunk) {
            writer.write(chunk);
        }

        const [pushLine, pushEnd] = useDeflate(process, response);

        pushLine('settings', {}, settings.props);

        for (const [id, vertex] of Object.entries(vertices)) {
            pushLine('vertex', { id }, { x: vertex.x, y: vertex.y, ...vertex.props });
        }

        for (const [u, area] of Object.entries(areas)) {
            for (const neighbor of Object.values(area.neighbors)) {
                let source;
                let target;
                if (neighbor.reversed) {
                    source = neighbor.v;
                    target = u;
                } else {
                    source = u;
                    target = neighbor.v;
                }
                pushLine('edge', { source, target }, neighbor.props);
            }
        }

        pushEnd();

        writer.close();
    });
}

import pako from 'pako';
import * as ponyfill from 'web-streams-polyfill/ponyfill';
import streamSaver from 'streamsaver';

if (!streamSaver.WritableStream) {
    streamSaver.WritableStream = ponyfill.WritableStream;
}


export default function (filename, settings, vertices, areas, initialize, finalize, warn) {
    const start = Date.now();
    try {
        const stream = streamSaver.createWriteStream(filename);

        initialize();

        const writer = stream.getWriter();

        window.addEventListener('unload', () => {
            writer.abort();
        });

        const encoder = new TextEncoder();
        const deflate = new pako.Deflate({ gzip: true });

        deflate.onData = (chunk) => {
            writer.write(chunk);
        };
        deflate.onEnd = (status) => {
            if (status !== 0) {
                throw deflate.msg;
            }
            finalize();
            console.log(`Saved in ${(Date.now() - start) / 1000} seconds`);
        };
        function push(type, data, props) {
            data.type = type;
            if (props !== null) {
                data.props = props;
            }
            const line = `${JSON.stringify(data)}\n`;
            deflate.push(encoder.encode(line), false);
        }

        push('settings', {}, settings.props);

        for (const [id, vertex] of Object.entries(vertices)) {
            push('vertex', { id }, { ...vertex.props, x: vertex.x, y: vertex.y });
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
                push('edge', { source, target }, neighbor.props);
            }
        }

        deflate.push(new Uint8Array(), true);
        writer.close();
    } catch (error) {
        warn(error);
        finalize();
    }
}

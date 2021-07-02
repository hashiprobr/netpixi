import pako from 'pako';
import streamSaver from 'streamsaver';


export default function (filename, settings, vertices, areas) {
    const start = Date.now();
    const stream = streamSaver.createWriteStream(filename);

    const writer = stream.getWriter();
    let active = true;

    window.addEventListener('unload', () => {
        active = false;
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

    if (active) {
        push('settings', {}, settings.props);
    }

    for (const [id, vertex] of Object.entries(vertices)) {
        if (active) {
            push('vertex', { id }, { ...vertex.props, x: vertex.x, y: vertex.y });
        }
    }

    for (const [u, area] of Object.entries(areas)) {
        if (active) {
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
    }

    if (active) {
        deflate.push(new Uint8Array(), true);
        writer.close();
    }
}

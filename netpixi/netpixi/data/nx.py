import networkx as nx

from networkx.drawing import layout as draw_nx

from .. import render
from ..util import serializable
from . import Loader, Saver, load, save


class NXLoader(Loader):
    def process_settings(self, directed, props):
        if directed:
            g = nx.DiGraph()
        else:
            g = nx.Graph()
        if props is not None:
            g.graph.update(props)
        return g

    def process_vertex(self, g, id, props):
        g.add_node(id)
        if props is not None:
            g.nodes[id].update(props)

    def process_edge(self, g, source, target, props):
        g.add_edge(source, target)
        if props is not None:
            g.edges[source, target].update(props)


class NXSaver(Saver):
    def validate(self, g):
        if 'directed' in g.graph:
            directed = g.graph['directed']
            if not isinstance(directed, bool):
                raise TypeError('Property directed of graph must be a boolean')
            if directed is not isinstance(g, nx.DiGraph):
                raise ValueError(f'Property directed of graph must be {not directed}')
        if not serializable(g.graph):
            raise ValueError('Properties of graph must be serializable')
        s = set()
        for source, target in g.edges:
            key = [source, target]
            if not isinstance(g, nx.DiGraph):
                key.sort()
            key = (key[0], key[1])
            if key in s:
                raise ValueError('Parallel edges not allowed')
            else:
                s.add(key)
        for id in g:
            if not isinstance(id, (int, str)):
                raise TypeError('Vertex ids must be integers or strings')
            if not serializable(g.nodes[id]):
                raise ValueError(f'Properties of vertex with id {id} must be serializable')
        for source, target in g.edges:
            if source == target:
                raise ValueError('Self-loops not allowed')
            if not serializable(g.edges[source, target]):
                raise ValueError(f'Properties of edge with source {source} and target {target} must be serializable')

    def settings(self, g):
        props = g.graph.copy()
        if 'edge' in props and isinstance(props['edge'], dict):
            edge = props.pop('edge')
        else:
            edge = {}
        if 'vertex' in props and isinstance(props['vertex'], dict):
            vertex = props.pop('vertex')
        else:
            vertex = {}
        if 'graph' in props and isinstance(props['graph'], dict) and len(props) == 1:
            graph = props.pop('graph')
        else:
            graph = props
            props = {}
        if 'directed' not in graph and isinstance(g, nx.DiGraph):
            graph['directed'] = True
        if graph:
            props['graph'] = graph
        if vertex:
            props['vertex'] = vertex
        if edge:
            props['edge'] = edge
        return {}, props

    def vertices(self, g):
        for id in g:
            data = {
                'id': id,
            }
            props = g.nodes[id].copy()
            yield data, props

    def edges(self, g):
        for source, target in g.edges:
            data = {
                'source': source,
                'target': target,
            }
            props = g.edges[source, target].copy()
            yield data, props


def load_nx(path):
    return load(NXLoader, path)


def save_nx(g, path):
    save(NXSaver, g, path)


def render_nx(g, path='temp_nx.net.gz', **kwargs):
    save_nx(g, path)
    return render(path, **kwargs)


def move_nx(g, layout):
    for id, (x, y) in layout.items():
        g.nodes[id]['_x'] = x
        g.nodes[id]['_y'] = y


__all__ = [
    'draw_nx',
    'load_nx',
    'save_nx',
    'render_nx',
    'move_nx',
]

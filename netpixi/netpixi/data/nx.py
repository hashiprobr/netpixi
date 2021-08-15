import networkx as nx

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

    def has_vertex(self, g, id):
        return g.has_node(id)

    def process_vertex(self, g, id, props):
        g.add_node(id)
        if props is not None:
            g.nodes[id].update(props)

    def has_edge(self, g, source, target):
        return g.has_edge(source, target)

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
        if not self._serializable(g.graph):
            raise ValueError('Properties of graph must be serializable')
        for id in g:
            if not isinstance(id, (int, str)):
                raise TypeError('Vertex ids must be integers or strings')
            if not self._serializable(g.nodes[id]):
                raise ValueError(f'Properties of vertex with id {id} must be serializable')
        for source, target in g.edges:
            if not self._serializable(g.edges[source, target]):
                raise ValueError(f'Properties of edge with source {source} and target {target} must be serializable')

    def settings(self, g):
        props = g.graph.copy()
        if 'directed' not in props:
            props['directed'] = isinstance(g, nx.DiGraph)
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
from warnings import filterwarnings, resetwarnings

filterwarnings('ignore')
from graph_tool import draw as gt_draw
resetwarnings()

import numpy as np

from ... import render
from .. import Loader, Saver, load, save, serializable
from .wrapper import Graph

from graph_tool import topology


class GTLoader(Loader):
    def process_settings(self, directed, props):
        g = Graph(directed=directed)
        if props is not None:
            for key, value in props.items():
                g.add_gp(key)
                g[key] = value
        return g

    def process_vertex(self, g, id, props):
        v = g.add_vertex(id)
        if props is not None:
            for key, value in props.items():
                g.add_vp(key)
                v[key] = value

    def process_edge(self, g, source, target, props):
        if source == target:
            print(f'Self-loop from {source} to {target} not allowed, ignoring')
            return
        if g.has_edge(source, target):
            print(f'Parallel edge from {source} to {target} not allowed, ignoring')
            return
        e = g.add_edge(source, target)
        if props is not None:
            for key, value in props.items():
                g.add_ep(key)
                e[key] = value


class GTSaver(Saver):
    def validate(self, g):
        if 'directed' in g:
            directed = g['directed']
            if not isinstance(directed, bool):
                raise TypeError('Property directed of graph must be a boolean')
            if directed is not g.is_directed():
                raise ValueError(f'Property directed of graph must be {not directed}')
        for key, map in g.gp.items():
            if map.value_type() == 'python::object':
                if not serializable(g[key]):
                    raise ValueError(f'Property {key} of graph must be serializable')
        for v in g.all_vertices():
            id = v.get_id()
            if not isinstance(id, (int, str)):
                raise TypeError('Vertex ids must be integers or strings')
            for key, map in g.vp.items():
                if key != 'id' and map.value_type() == 'python::object':
                    if not serializable(v[key]):
                        raise ValueError(f'Property {key} of vertex with id {id} must be serializable')
        s = set()
        for e in g.all_edges():
            source = e.get_source().get_id()
            target = e.get_target().get_id()
            if source == target:
                pass  # raise ValueError('Self-loops not allowed')
            if g.is_directed():
                key = (source, target)
            else:
                key = [source, target]
                key.sort(key=str)
                key = tuple(key)
            if key in s:
                pass  # raise ValueError('Parallel edges not allowed')
            else:
                s.add(key)
            for key, map in g.ep.items():
                if map.value_type() == 'python::object':
                    if not serializable(e[key]):
                        raise ValueError(f'Property {key} of edge with source {source} and target {target} must be serializable')

    def settings(self, g):
        props = {}
        for key, map in g.gp.items():
            type = map.value_type()
            if type == 'python::object':
                value = g[key]
                if value is not None:
                    props[key] = value
            else:
                if type.startswith('vector'):
                    props[key] = [value for value in g[key]]
                else:
                    props[key] = g[key]
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
        if 'directed' not in graph and g.is_directed():
            graph['directed'] = True
        if graph:
            props['graph'] = graph
        if vertex:
            props['vertex'] = vertex
        if edge:
            props['edge'] = edge
        return {}, props

    def vertices(self, g):
        for v in g.all_vertices():
            data = {
                'id': v.get_id(),
            }
            props = {}
            for key, map in g.vp.items():
                if key != 'id':
                    type = map.value_type()
                    if type == 'python::object':
                        value = v[key]
                        if value is not None:
                            props[key] = value
                    else:
                        if type.startswith('vector'):
                            props[key] = [value for value in v[key]]
                        else:
                            props[key] = v[key]
            yield data, props

    def edges(self, g):
        s = set()
        for e in g.all_edges():
            source = e.get_source().get_id()
            target = e.get_target().get_id()
            if source == target:
                continue
            if g.is_directed():
                key = (source, target)
            else:
                key = [source, target]
                key.sort(key=str)
                key = tuple(key)
            if key in s:
                continue
            else:
                s.add(key)
            data = {
                'source': e.get_source().get_id(),
                'target': e.get_target().get_id(),
            }
            props = {}
            for key, map in g.ep.items():
                type = map.value_type()
                if type == 'python::object':
                    value = e[key]
                    if value is not None:
                        props[key] = value
                else:
                    if type.startswith('vector'):
                        props[key] = [value for value in e[key]]
                    else:
                        props[key] = e[key]
            yield data, props


def bipartite_layout(g, top):
    layout = g.new_vp('object')
    step = 1 / (len(top) + 1)
    for i, v in enumerate(top, 1):
        layout[v] = (i * step, 0.25)
    bottom = [v for v in g.all_vertices() if v not in top]
    step = 1 / (len(bottom) + 1)
    for i, v in enumerate(bottom, 1):
        layout[v] = (i * step, 0.75)
    return layout


gt_draw.bipartite_layout = bipartite_layout


def gt_load(path):
    return load(GTLoader, path)


def gt_save(g, path):
    save(GTSaver, g, path)


def gt_render(g, path='gt_temp.net.gz', **kwargs):
    gt_save(g, path)
    return render(path, **kwargs)


def gt_move(g, layout):
    g.add_vp('_x')
    g.add_vp('_y')
    for v in g.all_vertices():
        x, y = layout[v]
        v['_x'] = x
        v['_y'] = y


def gt_clean(g):
    directed = topology.extract_largest_component(g, directed=False, prune=True)
    return Graph(directed=directed)


def gt_in_degree(g):
    vertices = g.get_vertices()
    d = g.new_vp('float')
    a = d.get_array()
    a[:] = g.get_in_degrees(vertices) / (len(vertices) - 1)
    return d


def gt_out_degree(g):
    vertices = g.get_vertices()
    d = g.new_vp('float')
    a = d.get_array()
    a[:] = g.get_out_degrees(vertices) / (len(vertices) - 1)
    return d


def gt_total_degree(g):
    vertices = g.get_vertices()
    d = g.new_vp('float')
    a = d.get_array()
    a[:] = g.get_total_degrees(vertices) / (len(vertices) - 1)
    if g.is_directed():
        a[:] /= 2
    return d


def gt_effective_size(g):
    vertices = g.get_vertices()
    degrees = g.get_out_degrees(vertices)
    mask = degrees > 0
    s = g.new_vp('float')
    a = s.get_array()
    t = np.zeros(len(vertices))
    for i in vertices[mask]:
        alters = g.get_out_neighbors(i)
        for j in alters:
            neighbors = g.get_out_neighbors(j)
            intersection = np.intersect1d(alters, neighbors)
            t[i] += len(intersection)
    a[mask] = degrees[mask] - t[mask] / degrees[mask]
    a[~mask] = 0
    return s


def gt_constraint(g):
    vertices = g.get_vertices()
    degrees = g.get_out_degrees(vertices)
    mask = degrees > 0
    c = g.new_vp('float')
    a = c.get_array()
    p = 1 / np.ma.array(degrees, mask=~mask)
    for i in vertices[mask]:
        alters = g.get_out_neighbors(i)
        a[i] = 0
        for j in alters:
            neighbors = g.get_in_neighbors(j)
            intersection = np.intersect1d(alters, neighbors)
            a[i] += (p[i] + sum(p[i] * p[intersection]))**2
    a[~mask] = 2
    return c


__all__ = [
    'Graph',
    'gt_draw',
    'gt_load',
    'gt_save',
    'gt_render',
    'gt_move',
    'gt_clean',
    'gt_in_degree',
    'gt_out_degree',
    'gt_total_degree',
    'gt_effective_size',
    'gt_constraint',
]

import graph_tool as gt

from wrapt import ObjectProxy


class Vertex(ObjectProxy):
    def __init__(self, v, g):
        super().__init__(v)
        self.g = g

    def _check(self, key):
        if key not in self.g.vp:
            raise KeyError(f'Vertex property {key} does not exist')

    def _neighbor(self, i):
        return Vertex(self.g.vertex(i), self.g)

    def _edge(self, i, j):
        return Edge(self.g.edge(i, j), self.g)

    def __str__(self):
        id = self.get_id()
        if not isinstance(id, str):
            id = str(id)
        return id

    def __getitem__(self, key):
        self._check(key)
        return self.g.vp[key][self.__wrapped__]

    def __setitem__(self, key, value):
        self._check(key)
        self.g.vp[key][self.__wrapped__] = value

    def __contains__(self, key):
        return key in self.g.vp

    def __iter__(self):
        return self.keys()

    def keys(self):
        return (key for key in self.g.vp.keys())

    def values(self):
        return (value[self.__wrapped__] for value in self.g.vp.values())

    def items(self):
        return ((key, value[self.__wrapped__]) for key, value in self.g.vp.items())

    def get_id(self):
        return self.g.vp.id[self.__wrapped__]

    def total_degree(self, weight=None):
        return self.in_degree(weight) + self.out_degree(weight)

    def iter_all_neighbors(self):
        return (self._neighbor(i) for i in self.g.iter_all_neighbors(self))

    def iter_in_neighbors(self):
        return (self._neighbor(i) for i in self.g.iter_in_neighbors(self))

    def iter_out_neighbors(self):
        return (self._neighbor(i) for i in self.g.iter_out_neighbors(self))

    def iter_all_edges(self):
        return (self._edge(i, j) for i, j in self.g.iter_all_edges(self))

    def iter_in_edges(self):
        return (self._edge(i, j) for i, j in self.g.iter_in_edges(self))

    def iter_out_edges(self):
        return (self._edge(i, j) for i, j in self.g.iter_out_edges(self))


class Edge(ObjectProxy):
    def __init__(self, e, g):
        super().__init__(e)
        self.g = g

    def _check(self, key):
        if key not in self.g.ep:
            raise KeyError(f'Edge property {key} does not exist')

    def __str__(self):
        source = self.g.vp.id[self.source()]
        target = self.g.vp.id[self.target()]
        return f'({source}, {target})'

    def __getitem__(self, key):
        self._check(key)
        return self.g.ep[key][self.__wrapped__]

    def __setitem__(self, key, value):
        self._check(key)
        self.g.ep[key][self.__wrapped__] = value

    def __contains__(self, key):
        return key in self.g.ep

    def __iter__(self):
        return self.keys()

    def keys(self):
        return (key for key in self.g.ep.keys())

    def values(self):
        return (value[self.__wrapped__] for value in self.g.ep.values())

    def items(self):
        return ((key, value[self.__wrapped__]) for key, value in self.g.ep.items())

    def get_source(self):
        return Vertex(self.source(), self.g)

    def get_target(self):
        return Vertex(self.target(), self.g)


class Graph(ObjectProxy):
    def __init__(self, directed=False, id_key=None):
        if isinstance(directed, bool):
            super().__init__(gt.Graph(directed=directed))
            self.vp.id = self.new_vp('object')
            self.vi = {}
        else:
            super().__init__(directed)
            if 'id' in self.vp:
                self.vp._id = self.vp.id
            if id_key is None:
                self.vp.id = self.new_vp('object')
                for v in self.vertices():
                    self.vp.id[v] = self.vertex_index[v]
            else:
                self.vp.id = self.vp[id_key]
                self.remove_vp(id_key)
            self._reset()

    def _reset(self):
        self.vi = {self.vp.id[v]: self.vertex_index[v] for v in self.vertices()}

    def _check(self, key):
        if key not in self.gp:
            raise KeyError(f'Graph property {key} does not exist')

    def _clean(self, id):
        if id not in self.vi:
            raise ValueError(f'Vertex with id {id} does not exist')
        return id

    def _vertex(self, id):
        return self.vertex(self.vi[self._clean(id)])

    def _edge(self, source, target):
        e = self.edge(self.vi[self._clean(source)], self.vi[self._clean(target)])
        if e is None:
            raise ValueError(f'Edge with source {source} and target {target} does not exist')
        return e

    def __getitem__(self, key):
        self._check(key)
        return self.gp[key]

    def __setitem__(self, key, value):
        self._check(key)
        self.gp[key] = value

    def __contains__(self, key):
        return key in self.gp

    def __iter__(self):
        return self.keys()

    def keys(self):
        return (key for key in self.gp.keys())

    def vertex_keys(self):
        return (key for key in self.vp.keys())

    def edge_keys(self):
        return (key for key in self.ep.keys())

    def values(self):
        return (value[self.__wrapped__] for value in self.gp.values())

    def items(self):
        return ((key, value[self.__wrapped__]) for key, value in self.gp.items())

    def has_vp(self, key):
        return key in self.vp

    def has_ep(self, key):
        return key in self.ep

    def add_gp(self, key, value=None):
        if value is None:
            if key not in self.gp:
                self.gp[key] = self.new_gp('object')
        else:
            self[key] = value

    def add_vp(self, key, value=None):
        if key == 'id':
            raise KeyError('Cannot add the id property of vertices')
        if value is None:
            if key not in self.vp:
                self.vp[key] = self.new_vp('object')
        else:
            self.vp[key] = value

    def add_ep(self, key, value=None):
        if value is None:
            if key not in self.ep:
                self.ep[key] = self.new_ep('object')
        else:
            self.ep[key] = value

    def remove_gp(self, key):
        if key in self.gp:
            del self.gp[key]

    def remove_vp(self, key):
        if key == 'id':
            raise KeyError('Cannot remove the id property of vertices')
        if key in self.vp:
            del self.vp[key]

    def remove_ep(self, key):
        if key in self.ep:
            del self.ep[key]

    def all_vertices(self):
        return (Vertex(v, self) for v in self.vertices())

    def all_edges(self):
        return (Edge(e, self) for e in self.edges())

    def has_vertex(self, id):
        return id in self.vi

    def has_edge(self, source, target):
        e = self.edge(self.vi[self._clean(source)], self.vi[self._clean(target)])
        return e is not None

    def get_vertex(self, id):
        return Vertex(self._vertex(id), self)

    def get_vertex_by_index(self, i):
        return Vertex(self.vertex(i), self)

    def get_edge(self, source, target):
        return Edge(self._edge(source, target), self)

    def add_vertex(self, id):
        if id in self.vi:
            raise ValueError(f'Vertex with id {id} already exists')
        v = self.__wrapped__.add_vertex()
        self.vp.id[v] = id
        self.vi[id] = self.vertex_index[v]
        return Vertex(v, self)

    def add_edge(self, source, target):
        if source == target:
            raise ValueError('Edge source and target must be different')
        i = self.vi[self._clean(source)]
        j = self.vi[self._clean(target)]
        if self.edge(i, j) is not None:
            raise ValueError(f'Edge with source {source} and target {target} already exists')
        e = self.__wrapped__.add_edge(i, j)
        return Edge(e, self)

    def remove_vertex(self, id):
        self.__wrapped__.remove_vertex(self._vertex(id))
        self._reset()

    def remove_edge(self, source, target):
        self.__wrapped__.remove_edge(self._edge(source, target))

    def set_directed(is_directed):
        raise NotImplementedError('Cannot set the directedness of the graph')

import json
import gzip

from json.decoder import JSONDecodeError

from abc import ABC, abstractmethod


class Loader(ABC):
    def _raise(self, Class, message):
        raise Class(f'Line {self.i}: {message}')

    def _pop(self, data, key):
        if key in data:
            value = data.pop(key)
            if isinstance(value, (int, str)):
                return value
            self._raise(TypeError, f'{key} must be an integer or a string')
        self._raise(ValueError, f'missing {key}')

    def load(self, path):
        g = None
        with gzip.open(path) as file:
            for self.i, line in enumerate(file, 1):
                try:
                    data = json.loads(line)
                except JSONDecodeError as error:
                    self._raise(ValueError, error.message)
                if not isinstance(data, dict):
                    self._raise(TypeError, f'must be a dictionary')

                props = data.pop('props', None)
                if props is not None and not isinstance(props, dict):
                    self._raise(TypeError, f'props must be None or a dictionary')

                dtype = data.get('type')
                if dtype == 'settings':
                    if g is None:
                        directed = False
                        settings = props.get('graph')
                        if isinstance(settings, dict):
                            value = settings.get('directed')
                            if isinstance(value, bool):
                                directed = value
                        g = self.process_settings(directed, props)
                    else:
                        self._raise(ValueError, f'duplicate settings')
                elif dtype == 'vertex':
                    id = self._pop(data, 'id')
                    if self.has_vertex(g, id):
                        self._raise(ValueError, f'duplicate vertex with id {id}')
                    self.process_vertex(g, id, props)
                elif dtype == 'edge':
                    source = self._pop(data, 'source')
                    if not self.has_vertex(g, source):
                        self._raise(ValueError, 'missing source with id {source}')
                    target = self._pop(data, 'target')
                    if not self.has_vertex(g, target):
                        self._raise(ValueError, 'missing target with id {target}')
                    if source == target:
                        self._raise(ValueError, 'source and target with same id')
                    if self.has_edge(g, source, target):
                        self._raise(ValueError, 'duplicate edge with source {source} and target {target}')
                    self.process_edge(g, source, target, props)
                else:
                    self._raise(ValueError, f'unknown type')
        return g

    @abstractmethod
    def process_settings(self, directed, props):
        pass

    @abstractmethod
    def has_vertex(self, g, id):
        pass

    @abstractmethod
    def process_vertex(self, g, id, props):
        pass

    @abstractmethod
    def has_edge(self, g, source, target):
        pass

    @abstractmethod
    def process_edge(self, g, source, target, props):
        pass


class Saver(ABC):
    def _write(self, dtype, data, props, file):
        data['type'] = dtype
        data['props'] = props
        line = f'{json.dumps(data)}\n'
        file.write(line.encode())

    def _serializable(self, props):
        if props is None:
            return True
        if isinstance(props, (bool, int, float, str)):
            return True
        if isinstance(props, list):
            for value in props:
                if not self._serializable(value):
                    return False
            return True
        if isinstance(props, dict):
            for key, value in props.items():
                if not isinstance(key, (int, str)):
                    return False
                if not self._serializable(value):
                    return False
            return True
        return False

    def save(self, g, path):
        self.validate(g)
        with gzip.open(path, 'w') as file:
            data, props = self.settings(g)
            self._write('settings', data, props, file)
            for data, props in self.vertices(g):
                self._write('vertex', data, props, file)
            for data, props in self.edges(g):
                self._write('edge', data, props, file)

    @abstractmethod
    def validate(self, g):
        pass

    @abstractmethod
    def settings(self, g):
        pass

    @abstractmethod
    def vertices(self, g):
        pass

    @abstractmethod
    def edges(self, g):
        pass


def load(Class, path):
    loader = Class()
    return loader.load(path)


def save(Class, g, path):
    saver = Class()
    saver.save(g, path)

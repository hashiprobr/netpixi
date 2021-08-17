def serializable(props):
    if props is None:
        return True

    if isinstance(props, (bool, int, float, str)):
        return True

    if isinstance(props, list):
        for value in props:
            if not serializable(value):
                return False
        return True

    if isinstance(props, dict):
        for key, value in props.items():
            if not isinstance(key, (int, str)):
                return False
            if not serializable(value):
                return False
        return True

    return False

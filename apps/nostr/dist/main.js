var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
/**
* @vue/shared v3.4.19
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
function makeMap$2(str, expectsLowerCase) {
  const set2 = new Set(str.split(","));
  return expectsLowerCase ? (val) => set2.has(val.toLowerCase()) : (val) => set2.has(val);
}
const NOOP$1 = () => {
};
const hasOwnProperty$2 = Object.prototype.hasOwnProperty;
const hasOwn$1 = (val, key) => hasOwnProperty$2.call(val, key);
const isArray$3 = Array.isArray;
const isMap$1 = (val) => toTypeString$2(val) === "[object Map]";
const isFunction$2 = (val) => typeof val === "function";
const isString$2 = (val) => typeof val === "string";
const isSymbol$2 = (val) => typeof val === "symbol";
const isObject$2 = (val) => val !== null && typeof val === "object";
const objectToString$2 = Object.prototype.toString;
const toTypeString$2 = (value) => objectToString$2.call(value);
const toRawType = (value) => {
  return toTypeString$2(value).slice(8, -1);
};
const isIntegerKey = (key) => isString$2(key) && key !== "NaN" && key[0] !== "-" && "" + parseInt(key, 10) === key;
const hasChanged$1 = (value, oldValue) => !Object.is(value, oldValue);
const def$1 = (obj, key, value) => {
  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: false,
    value
  });
};
/**
* @vue/reactivity v3.4.19
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
let activeEffectScope;
class EffectScope {
  constructor(detached = false) {
    this.detached = detached;
    this._active = true;
    this.effects = [];
    this.cleanups = [];
    this.parent = activeEffectScope;
    if (!detached && activeEffectScope) {
      this.index = (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(
        this
      ) - 1;
    }
  }
  get active() {
    return this._active;
  }
  run(fn) {
    if (this._active) {
      const currentEffectScope = activeEffectScope;
      try {
        activeEffectScope = this;
        return fn();
      } finally {
        activeEffectScope = currentEffectScope;
      }
    }
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  on() {
    activeEffectScope = this;
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  off() {
    activeEffectScope = this.parent;
  }
  stop(fromParent) {
    if (this._active) {
      let i2, l;
      for (i2 = 0, l = this.effects.length; i2 < l; i2++) {
        this.effects[i2].stop();
      }
      for (i2 = 0, l = this.cleanups.length; i2 < l; i2++) {
        this.cleanups[i2]();
      }
      if (this.scopes) {
        for (i2 = 0, l = this.scopes.length; i2 < l; i2++) {
          this.scopes[i2].stop(true);
        }
      }
      if (!this.detached && this.parent && !fromParent) {
        const last = this.parent.scopes.pop();
        if (last && last !== this) {
          this.parent.scopes[this.index] = last;
          last.index = this.index;
        }
      }
      this.parent = void 0;
      this._active = false;
    }
  }
}
function effectScope(detached) {
  return new EffectScope(detached);
}
function recordEffectScope(effect, scope = activeEffectScope) {
  if (scope && scope.active) {
    scope.effects.push(effect);
  }
}
function getCurrentScope() {
  return activeEffectScope;
}
function onScopeDispose(fn) {
  if (activeEffectScope) {
    activeEffectScope.cleanups.push(fn);
  }
}
let activeEffect;
class ReactiveEffect {
  constructor(fn, trigger2, scheduler, scope) {
    this.fn = fn;
    this.trigger = trigger2;
    this.scheduler = scheduler;
    this.active = true;
    this.deps = [];
    this._dirtyLevel = 4;
    this._trackId = 0;
    this._runnings = 0;
    this._shouldSchedule = false;
    this._depsLength = 0;
    recordEffectScope(this, scope);
  }
  get dirty() {
    if (this._dirtyLevel === 2 || this._dirtyLevel === 3) {
      this._dirtyLevel = 1;
      pauseTracking();
      for (let i2 = 0; i2 < this._depsLength; i2++) {
        const dep = this.deps[i2];
        if (dep.computed) {
          triggerComputed(dep.computed);
          if (this._dirtyLevel >= 4) {
            break;
          }
        }
      }
      if (this._dirtyLevel === 1) {
        this._dirtyLevel = 0;
      }
      resetTracking();
    }
    return this._dirtyLevel >= 4;
  }
  set dirty(v) {
    this._dirtyLevel = v ? 4 : 0;
  }
  run() {
    this._dirtyLevel = 0;
    if (!this.active) {
      return this.fn();
    }
    let lastShouldTrack = shouldTrack;
    let lastEffect = activeEffect;
    try {
      shouldTrack = true;
      activeEffect = this;
      this._runnings++;
      preCleanupEffect(this);
      return this.fn();
    } finally {
      postCleanupEffect(this);
      this._runnings--;
      activeEffect = lastEffect;
      shouldTrack = lastShouldTrack;
    }
  }
  stop() {
    var _a;
    if (this.active) {
      preCleanupEffect(this);
      postCleanupEffect(this);
      (_a = this.onStop) == null ? void 0 : _a.call(this);
      this.active = false;
    }
  }
}
function triggerComputed(computed2) {
  return computed2.value;
}
function preCleanupEffect(effect2) {
  effect2._trackId++;
  effect2._depsLength = 0;
}
function postCleanupEffect(effect2) {
  if (effect2.deps.length > effect2._depsLength) {
    for (let i2 = effect2._depsLength; i2 < effect2.deps.length; i2++) {
      cleanupDepEffect(effect2.deps[i2], effect2);
    }
    effect2.deps.length = effect2._depsLength;
  }
}
function cleanupDepEffect(dep, effect2) {
  const trackId = dep.get(effect2);
  if (trackId !== void 0 && effect2._trackId !== trackId) {
    dep.delete(effect2);
    if (dep.size === 0) {
      dep.cleanup();
    }
  }
}
let shouldTrack = true;
let pauseScheduleStack = 0;
const trackStack = [];
function pauseTracking() {
  trackStack.push(shouldTrack);
  shouldTrack = false;
}
function resetTracking() {
  const last = trackStack.pop();
  shouldTrack = last === void 0 ? true : last;
}
function pauseScheduling() {
  pauseScheduleStack++;
}
function resetScheduling() {
  pauseScheduleStack--;
  while (!pauseScheduleStack && queueEffectSchedulers.length) {
    queueEffectSchedulers.shift()();
  }
}
function trackEffect(effect2, dep, debuggerEventExtraInfo) {
  if (dep.get(effect2) !== effect2._trackId) {
    dep.set(effect2, effect2._trackId);
    const oldDep = effect2.deps[effect2._depsLength];
    if (oldDep !== dep) {
      if (oldDep) {
        cleanupDepEffect(oldDep, effect2);
      }
      effect2.deps[effect2._depsLength++] = dep;
    } else {
      effect2._depsLength++;
    }
  }
}
const queueEffectSchedulers = [];
function triggerEffects(dep, dirtyLevel, debuggerEventExtraInfo) {
  pauseScheduling();
  for (const effect2 of dep.keys()) {
    let tracking;
    if (effect2._dirtyLevel < dirtyLevel && (tracking != null ? tracking : tracking = dep.get(effect2) === effect2._trackId)) {
      effect2._shouldSchedule || (effect2._shouldSchedule = effect2._dirtyLevel === 0);
      effect2._dirtyLevel = dirtyLevel;
    }
    if (effect2._shouldSchedule && (tracking != null ? tracking : tracking = dep.get(effect2) === effect2._trackId)) {
      effect2.trigger();
      if ((!effect2._runnings || effect2.allowRecurse) && effect2._dirtyLevel !== 2) {
        effect2._shouldSchedule = false;
        if (effect2.scheduler) {
          queueEffectSchedulers.push(effect2.scheduler);
        }
      }
    }
  }
  resetScheduling();
}
const createDep = (cleanup, computed2) => {
  const dep = /* @__PURE__ */ new Map();
  dep.cleanup = cleanup;
  dep.computed = computed2;
  return dep;
};
const targetMap = /* @__PURE__ */ new WeakMap();
const ITERATE_KEY = Symbol("");
const MAP_KEY_ITERATE_KEY = Symbol("");
function track(target, type, key) {
  if (shouldTrack && activeEffect) {
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      targetMap.set(target, depsMap = /* @__PURE__ */ new Map());
    }
    let dep = depsMap.get(key);
    if (!dep) {
      depsMap.set(key, dep = createDep(() => depsMap.delete(key)));
    }
    trackEffect(
      activeEffect,
      dep
    );
  }
}
function trigger(target, type, key, newValue, oldValue, oldTarget) {
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    return;
  }
  let deps = [];
  if (type === "clear") {
    deps = [...depsMap.values()];
  } else if (key === "length" && isArray$3(target)) {
    const newLength = Number(newValue);
    depsMap.forEach((dep, key2) => {
      if (key2 === "length" || !isSymbol$2(key2) && key2 >= newLength) {
        deps.push(dep);
      }
    });
  } else {
    if (key !== void 0) {
      deps.push(depsMap.get(key));
    }
    switch (type) {
      case "add":
        if (!isArray$3(target)) {
          deps.push(depsMap.get(ITERATE_KEY));
          if (isMap$1(target)) {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY));
          }
        } else if (isIntegerKey(key)) {
          deps.push(depsMap.get("length"));
        }
        break;
      case "delete":
        if (!isArray$3(target)) {
          deps.push(depsMap.get(ITERATE_KEY));
          if (isMap$1(target)) {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY));
          }
        }
        break;
      case "set":
        if (isMap$1(target)) {
          deps.push(depsMap.get(ITERATE_KEY));
        }
        break;
    }
  }
  pauseScheduling();
  for (const dep of deps) {
    if (dep) {
      triggerEffects(
        dep,
        4
      );
    }
  }
  resetScheduling();
}
function getDepFromReactive(object, key) {
  var _a;
  return (_a = targetMap.get(object)) == null ? void 0 : _a.get(key);
}
const isNonTrackableKeys = /* @__PURE__ */ makeMap$2(`__proto__,__v_isRef,__isVue`);
const builtInSymbols = new Set(
  /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((key) => key !== "arguments" && key !== "caller").map((key) => Symbol[key]).filter(isSymbol$2)
);
const arrayInstrumentations = /* @__PURE__ */ createArrayInstrumentations();
function createArrayInstrumentations() {
  const instrumentations = {};
  ["includes", "indexOf", "lastIndexOf"].forEach((key) => {
    instrumentations[key] = function(...args) {
      const arr = toRaw(this);
      for (let i2 = 0, l = this.length; i2 < l; i2++) {
        track(arr, "get", i2 + "");
      }
      const res = arr[key](...args);
      if (res === -1 || res === false) {
        return arr[key](...args.map(toRaw));
      } else {
        return res;
      }
    };
  });
  ["push", "pop", "shift", "unshift", "splice"].forEach((key) => {
    instrumentations[key] = function(...args) {
      pauseTracking();
      pauseScheduling();
      const res = toRaw(this)[key].apply(this, args);
      resetScheduling();
      resetTracking();
      return res;
    };
  });
  return instrumentations;
}
function hasOwnProperty$1(key) {
  const obj = toRaw(this);
  track(obj, "has", key);
  return obj.hasOwnProperty(key);
}
class BaseReactiveHandler {
  constructor(_isReadonly = false, _shallow = false) {
    this._isReadonly = _isReadonly;
    this._shallow = _shallow;
  }
  get(target, key, receiver) {
    const isReadonly2 = this._isReadonly, shallow = this._shallow;
    if (key === "__v_isReactive") {
      return !isReadonly2;
    } else if (key === "__v_isReadonly") {
      return isReadonly2;
    } else if (key === "__v_isShallow") {
      return shallow;
    } else if (key === "__v_raw") {
      if (receiver === (isReadonly2 ? shallow ? shallowReadonlyMap : readonlyMap : shallow ? shallowReactiveMap : reactiveMap).get(target) || // receiver is not the reactive proxy, but has the same prototype
      // this means the reciever is a user proxy of the reactive proxy
      Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)) {
        return target;
      }
      return;
    }
    const targetIsArray = isArray$3(target);
    if (!isReadonly2) {
      if (targetIsArray && hasOwn$1(arrayInstrumentations, key)) {
        return Reflect.get(arrayInstrumentations, key, receiver);
      }
      if (key === "hasOwnProperty") {
        return hasOwnProperty$1;
      }
    }
    const res = Reflect.get(target, key, receiver);
    if (isSymbol$2(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
      return res;
    }
    if (!isReadonly2) {
      track(target, "get", key);
    }
    if (shallow) {
      return res;
    }
    if (isRef(res)) {
      return targetIsArray && isIntegerKey(key) ? res : res.value;
    }
    if (isObject$2(res)) {
      return isReadonly2 ? readonly(res) : reactive(res);
    }
    return res;
  }
}
class MutableReactiveHandler extends BaseReactiveHandler {
  constructor(shallow = false) {
    super(false, shallow);
  }
  set(target, key, value, receiver) {
    let oldValue = target[key];
    if (!this._shallow) {
      const isOldValueReadonly = isReadonly(oldValue);
      if (!isShallow(value) && !isReadonly(value)) {
        oldValue = toRaw(oldValue);
        value = toRaw(value);
      }
      if (!isArray$3(target) && isRef(oldValue) && !isRef(value)) {
        if (isOldValueReadonly) {
          return false;
        } else {
          oldValue.value = value;
          return true;
        }
      }
    }
    const hadKey = isArray$3(target) && isIntegerKey(key) ? Number(key) < target.length : hasOwn$1(target, key);
    const result = Reflect.set(target, key, value, receiver);
    if (target === toRaw(receiver)) {
      if (!hadKey) {
        trigger(target, "add", key, value);
      } else if (hasChanged$1(value, oldValue)) {
        trigger(target, "set", key, value);
      }
    }
    return result;
  }
  deleteProperty(target, key) {
    const hadKey = hasOwn$1(target, key);
    target[key];
    const result = Reflect.deleteProperty(target, key);
    if (result && hadKey) {
      trigger(target, "delete", key, void 0);
    }
    return result;
  }
  has(target, key) {
    const result = Reflect.has(target, key);
    if (!isSymbol$2(key) || !builtInSymbols.has(key)) {
      track(target, "has", key);
    }
    return result;
  }
  ownKeys(target) {
    track(
      target,
      "iterate",
      isArray$3(target) ? "length" : ITERATE_KEY
    );
    return Reflect.ownKeys(target);
  }
}
class ReadonlyReactiveHandler extends BaseReactiveHandler {
  constructor(shallow = false) {
    super(true, shallow);
  }
  set(target, key) {
    return true;
  }
  deleteProperty(target, key) {
    return true;
  }
}
const mutableHandlers = /* @__PURE__ */ new MutableReactiveHandler();
const readonlyHandlers = /* @__PURE__ */ new ReadonlyReactiveHandler();
const shallowReactiveHandlers = /* @__PURE__ */ new MutableReactiveHandler(
  true
);
const toShallow = (value) => value;
const getProto = (v) => Reflect.getPrototypeOf(v);
function get(target, key, isReadonly2 = false, isShallow2 = false) {
  target = target["__v_raw"];
  const rawTarget = toRaw(target);
  const rawKey = toRaw(key);
  if (!isReadonly2) {
    if (hasChanged$1(key, rawKey)) {
      track(rawTarget, "get", key);
    }
    track(rawTarget, "get", rawKey);
  }
  const { has: has2 } = getProto(rawTarget);
  const wrap = isShallow2 ? toShallow : isReadonly2 ? toReadonly : toReactive;
  if (has2.call(rawTarget, key)) {
    return wrap(target.get(key));
  } else if (has2.call(rawTarget, rawKey)) {
    return wrap(target.get(rawKey));
  } else if (target !== rawTarget) {
    target.get(key);
  }
}
function has(key, isReadonly2 = false) {
  const target = this["__v_raw"];
  const rawTarget = toRaw(target);
  const rawKey = toRaw(key);
  if (!isReadonly2) {
    if (hasChanged$1(key, rawKey)) {
      track(rawTarget, "has", key);
    }
    track(rawTarget, "has", rawKey);
  }
  return key === rawKey ? target.has(key) : target.has(key) || target.has(rawKey);
}
function size(target, isReadonly2 = false) {
  target = target["__v_raw"];
  !isReadonly2 && track(toRaw(target), "iterate", ITERATE_KEY);
  return Reflect.get(target, "size", target);
}
function add(value) {
  value = toRaw(value);
  const target = toRaw(this);
  const proto = getProto(target);
  const hadKey = proto.has.call(target, value);
  if (!hadKey) {
    target.add(value);
    trigger(target, "add", value, value);
  }
  return this;
}
function set(key, value) {
  value = toRaw(value);
  const target = toRaw(this);
  const { has: has2, get: get2 } = getProto(target);
  let hadKey = has2.call(target, key);
  if (!hadKey) {
    key = toRaw(key);
    hadKey = has2.call(target, key);
  }
  const oldValue = get2.call(target, key);
  target.set(key, value);
  if (!hadKey) {
    trigger(target, "add", key, value);
  } else if (hasChanged$1(value, oldValue)) {
    trigger(target, "set", key, value);
  }
  return this;
}
function deleteEntry(key) {
  const target = toRaw(this);
  const { has: has2, get: get2 } = getProto(target);
  let hadKey = has2.call(target, key);
  if (!hadKey) {
    key = toRaw(key);
    hadKey = has2.call(target, key);
  }
  get2 ? get2.call(target, key) : void 0;
  const result = target.delete(key);
  if (hadKey) {
    trigger(target, "delete", key, void 0);
  }
  return result;
}
function clear() {
  const target = toRaw(this);
  const hadItems = target.size !== 0;
  const result = target.clear();
  if (hadItems) {
    trigger(target, "clear", void 0, void 0);
  }
  return result;
}
function createForEach(isReadonly2, isShallow2) {
  return function forEach(callback, thisArg) {
    const observed = this;
    const target = observed["__v_raw"];
    const rawTarget = toRaw(target);
    const wrap = isShallow2 ? toShallow : isReadonly2 ? toReadonly : toReactive;
    !isReadonly2 && track(rawTarget, "iterate", ITERATE_KEY);
    return target.forEach((value, key) => {
      return callback.call(thisArg, wrap(value), wrap(key), observed);
    });
  };
}
function createIterableMethod(method, isReadonly2, isShallow2) {
  return function(...args) {
    const target = this["__v_raw"];
    const rawTarget = toRaw(target);
    const targetIsMap = isMap$1(rawTarget);
    const isPair = method === "entries" || method === Symbol.iterator && targetIsMap;
    const isKeyOnly = method === "keys" && targetIsMap;
    const innerIterator = target[method](...args);
    const wrap = isShallow2 ? toShallow : isReadonly2 ? toReadonly : toReactive;
    !isReadonly2 && track(
      rawTarget,
      "iterate",
      isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY
    );
    return {
      // iterator protocol
      next() {
        const { value, done } = innerIterator.next();
        return done ? { value, done } : {
          value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
          done
        };
      },
      // iterable protocol
      [Symbol.iterator]() {
        return this;
      }
    };
  };
}
function createReadonlyMethod(type) {
  return function(...args) {
    return type === "delete" ? false : type === "clear" ? void 0 : this;
  };
}
function createInstrumentations() {
  const mutableInstrumentations2 = {
    get(key) {
      return get(this, key);
    },
    get size() {
      return size(this);
    },
    has,
    add,
    set,
    delete: deleteEntry,
    clear,
    forEach: createForEach(false, false)
  };
  const shallowInstrumentations2 = {
    get(key) {
      return get(this, key, false, true);
    },
    get size() {
      return size(this);
    },
    has,
    add,
    set,
    delete: deleteEntry,
    clear,
    forEach: createForEach(false, true)
  };
  const readonlyInstrumentations2 = {
    get(key) {
      return get(this, key, true);
    },
    get size() {
      return size(this, true);
    },
    has(key) {
      return has.call(this, key, true);
    },
    add: createReadonlyMethod("add"),
    set: createReadonlyMethod("set"),
    delete: createReadonlyMethod("delete"),
    clear: createReadonlyMethod("clear"),
    forEach: createForEach(true, false)
  };
  const shallowReadonlyInstrumentations2 = {
    get(key) {
      return get(this, key, true, true);
    },
    get size() {
      return size(this, true);
    },
    has(key) {
      return has.call(this, key, true);
    },
    add: createReadonlyMethod("add"),
    set: createReadonlyMethod("set"),
    delete: createReadonlyMethod("delete"),
    clear: createReadonlyMethod("clear"),
    forEach: createForEach(true, true)
  };
  const iteratorMethods = ["keys", "values", "entries", Symbol.iterator];
  iteratorMethods.forEach((method) => {
    mutableInstrumentations2[method] = createIterableMethod(
      method,
      false,
      false
    );
    readonlyInstrumentations2[method] = createIterableMethod(
      method,
      true,
      false
    );
    shallowInstrumentations2[method] = createIterableMethod(
      method,
      false,
      true
    );
    shallowReadonlyInstrumentations2[method] = createIterableMethod(
      method,
      true,
      true
    );
  });
  return [
    mutableInstrumentations2,
    readonlyInstrumentations2,
    shallowInstrumentations2,
    shallowReadonlyInstrumentations2
  ];
}
const [
  mutableInstrumentations,
  readonlyInstrumentations,
  shallowInstrumentations,
  shallowReadonlyInstrumentations
] = /* @__PURE__ */ createInstrumentations();
function createInstrumentationGetter(isReadonly2, shallow) {
  const instrumentations = shallow ? isReadonly2 ? shallowReadonlyInstrumentations : shallowInstrumentations : isReadonly2 ? readonlyInstrumentations : mutableInstrumentations;
  return (target, key, receiver) => {
    if (key === "__v_isReactive") {
      return !isReadonly2;
    } else if (key === "__v_isReadonly") {
      return isReadonly2;
    } else if (key === "__v_raw") {
      return target;
    }
    return Reflect.get(
      hasOwn$1(instrumentations, key) && key in target ? instrumentations : target,
      key,
      receiver
    );
  };
}
const mutableCollectionHandlers = {
  get: /* @__PURE__ */ createInstrumentationGetter(false, false)
};
const shallowCollectionHandlers = {
  get: /* @__PURE__ */ createInstrumentationGetter(false, true)
};
const readonlyCollectionHandlers = {
  get: /* @__PURE__ */ createInstrumentationGetter(true, false)
};
const reactiveMap = /* @__PURE__ */ new WeakMap();
const shallowReactiveMap = /* @__PURE__ */ new WeakMap();
const readonlyMap = /* @__PURE__ */ new WeakMap();
const shallowReadonlyMap = /* @__PURE__ */ new WeakMap();
function targetTypeMap(rawType) {
  switch (rawType) {
    case "Object":
    case "Array":
      return 1;
    case "Map":
    case "Set":
    case "WeakMap":
    case "WeakSet":
      return 2;
    default:
      return 0;
  }
}
function getTargetType(value) {
  return value["__v_skip"] || !Object.isExtensible(value) ? 0 : targetTypeMap(toRawType(value));
}
function reactive(target) {
  if (isReadonly(target)) {
    return target;
  }
  return createReactiveObject(
    target,
    false,
    mutableHandlers,
    mutableCollectionHandlers,
    reactiveMap
  );
}
function shallowReactive(target) {
  return createReactiveObject(
    target,
    false,
    shallowReactiveHandlers,
    shallowCollectionHandlers,
    shallowReactiveMap
  );
}
function readonly(target) {
  return createReactiveObject(
    target,
    true,
    readonlyHandlers,
    readonlyCollectionHandlers,
    readonlyMap
  );
}
function createReactiveObject(target, isReadonly2, baseHandlers, collectionHandlers, proxyMap) {
  if (!isObject$2(target)) {
    return target;
  }
  if (target["__v_raw"] && !(isReadonly2 && target["__v_isReactive"])) {
    return target;
  }
  const existingProxy = proxyMap.get(target);
  if (existingProxy) {
    return existingProxy;
  }
  const targetType = getTargetType(target);
  if (targetType === 0) {
    return target;
  }
  const proxy = new Proxy(
    target,
    targetType === 2 ? collectionHandlers : baseHandlers
  );
  proxyMap.set(target, proxy);
  return proxy;
}
function isReactive(value) {
  if (isReadonly(value)) {
    return isReactive(value["__v_raw"]);
  }
  return !!(value && value["__v_isReactive"]);
}
function isReadonly(value) {
  return !!(value && value["__v_isReadonly"]);
}
function isShallow(value) {
  return !!(value && value["__v_isShallow"]);
}
function isProxy(value) {
  return isReactive(value) || isReadonly(value);
}
function toRaw(observed) {
  const raw = observed && observed["__v_raw"];
  return raw ? toRaw(raw) : observed;
}
function markRaw(value) {
  if (Object.isExtensible(value)) {
    def$1(value, "__v_skip", true);
  }
  return value;
}
const toReactive = (value) => isObject$2(value) ? reactive(value) : value;
const toReadonly = (value) => isObject$2(value) ? readonly(value) : value;
class ComputedRefImpl {
  constructor(getter, _setter, isReadonly2, isSSR) {
    this._setter = _setter;
    this.dep = void 0;
    this.__v_isRef = true;
    this["__v_isReadonly"] = false;
    this.effect = new ReactiveEffect(
      () => getter(this._value),
      () => triggerRefValue(
        this,
        this.effect._dirtyLevel === 2 ? 2 : 3
      )
    );
    this.effect.computed = this;
    this.effect.active = this._cacheable = !isSSR;
    this["__v_isReadonly"] = isReadonly2;
  }
  get value() {
    const self2 = toRaw(this);
    if ((!self2._cacheable || self2.effect.dirty) && hasChanged$1(self2._value, self2._value = self2.effect.run())) {
      triggerRefValue(self2, 4);
    }
    trackRefValue(self2);
    if (self2.effect._dirtyLevel >= 2) {
      triggerRefValue(self2, 2);
    }
    return self2._value;
  }
  set value(newValue) {
    this._setter(newValue);
  }
  // #region polyfill _dirty for backward compatibility third party code for Vue <= 3.3.x
  get _dirty() {
    return this.effect.dirty;
  }
  set _dirty(v) {
    this.effect.dirty = v;
  }
  // #endregion
}
function computed$1(getterOrOptions, debugOptions, isSSR = false) {
  let getter;
  let setter;
  const onlyGetter = isFunction$2(getterOrOptions);
  if (onlyGetter) {
    getter = getterOrOptions;
    setter = NOOP$1;
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }
  const cRef = new ComputedRefImpl(getter, setter, onlyGetter || !setter, isSSR);
  return cRef;
}
function trackRefValue(ref2) {
  var _a;
  if (shouldTrack && activeEffect) {
    ref2 = toRaw(ref2);
    trackEffect(
      activeEffect,
      (_a = ref2.dep) != null ? _a : ref2.dep = createDep(
        () => ref2.dep = void 0,
        ref2 instanceof ComputedRefImpl ? ref2 : void 0
      )
    );
  }
}
function triggerRefValue(ref2, dirtyLevel = 4, newVal) {
  ref2 = toRaw(ref2);
  const dep = ref2.dep;
  if (dep) {
    triggerEffects(
      dep,
      dirtyLevel
    );
  }
}
function isRef(r) {
  return !!(r && r.__v_isRef === true);
}
function ref(value) {
  return createRef(value, false);
}
function shallowRef(value) {
  return createRef(value, true);
}
function createRef(rawValue, shallow) {
  if (isRef(rawValue)) {
    return rawValue;
  }
  return new RefImpl(rawValue, shallow);
}
class RefImpl {
  constructor(value, __v_isShallow) {
    this.__v_isShallow = __v_isShallow;
    this.dep = void 0;
    this.__v_isRef = true;
    this._rawValue = __v_isShallow ? value : toRaw(value);
    this._value = __v_isShallow ? value : toReactive(value);
  }
  get value() {
    trackRefValue(this);
    return this._value;
  }
  set value(newVal) {
    const useDirectValue = this.__v_isShallow || isShallow(newVal) || isReadonly(newVal);
    newVal = useDirectValue ? newVal : toRaw(newVal);
    if (hasChanged$1(newVal, this._rawValue)) {
      this._rawValue = newVal;
      this._value = useDirectValue ? newVal : toReactive(newVal);
      triggerRefValue(this, 4);
    }
  }
}
function unref(ref2) {
  return isRef(ref2) ? ref2.value : ref2;
}
const shallowUnwrapHandlers = {
  get: (target, key, receiver) => unref(Reflect.get(target, key, receiver)),
  set: (target, key, value, receiver) => {
    const oldValue = target[key];
    if (isRef(oldValue) && !isRef(value)) {
      oldValue.value = value;
      return true;
    } else {
      return Reflect.set(target, key, value, receiver);
    }
  }
};
function proxyRefs(objectWithRefs) {
  return isReactive(objectWithRefs) ? objectWithRefs : new Proxy(objectWithRefs, shallowUnwrapHandlers);
}
function toRefs(object) {
  const ret = isArray$3(object) ? new Array(object.length) : {};
  for (const key in object) {
    ret[key] = propertyToRef(object, key);
  }
  return ret;
}
class ObjectRefImpl {
  constructor(_object, _key, _defaultValue) {
    this._object = _object;
    this._key = _key;
    this._defaultValue = _defaultValue;
    this.__v_isRef = true;
  }
  get value() {
    const val = this._object[this._key];
    return val === void 0 ? this._defaultValue : val;
  }
  set value(newVal) {
    this._object[this._key] = newVal;
  }
  get dep() {
    return getDepFromReactive(toRaw(this._object), this._key);
  }
}
function propertyToRef(source, key, defaultValue) {
  const val = source[key];
  return isRef(val) ? val : new ObjectRefImpl(source, key, defaultValue);
}
/**
* @vue/shared v3.4.19
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
function makeMap$1(str, expectsLowerCase) {
  const set2 = new Set(str.split(","));
  return expectsLowerCase ? (val) => set2.has(val.toLowerCase()) : (val) => set2.has(val);
}
const EMPTY_OBJ = {};
const EMPTY_ARR = [];
const NOOP = () => {
};
const NO = () => false;
const isOn$1 = (key) => key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && // uppercase letter
(key.charCodeAt(2) > 122 || key.charCodeAt(2) < 97);
const isModelListener$1 = (key) => key.startsWith("onUpdate:");
const extend$1 = Object.assign;
const remove = (arr, el) => {
  const i2 = arr.indexOf(el);
  if (i2 > -1) {
    arr.splice(i2, 1);
  }
};
const hasOwnProperty = Object.prototype.hasOwnProperty;
const hasOwn = (val, key) => hasOwnProperty.call(val, key);
const isArray$2 = Array.isArray;
const isMap = (val) => toTypeString$1(val) === "[object Map]";
const isSet$1 = (val) => toTypeString$1(val) === "[object Set]";
const isFunction$1 = (val) => typeof val === "function";
const isString$1 = (val) => typeof val === "string";
const isSymbol$1 = (val) => typeof val === "symbol";
const isObject$1 = (val) => val !== null && typeof val === "object";
const isPromise = (val) => {
  return (isObject$1(val) || isFunction$1(val)) && isFunction$1(val.then) && isFunction$1(val.catch);
};
const objectToString$1 = Object.prototype.toString;
const toTypeString$1 = (value) => objectToString$1.call(value);
const isPlainObject$1 = (val) => toTypeString$1(val) === "[object Object]";
const isReservedProp = /* @__PURE__ */ makeMap$1(
  // the leading comma is intentional so empty string "" is also included
  ",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"
);
const cacheStringFunction$1 = (fn) => {
  const cache = /* @__PURE__ */ Object.create(null);
  return (str) => {
    const hit = cache[str];
    return hit || (cache[str] = fn(str));
  };
};
const camelizeRE = /-(\w)/g;
const camelize = cacheStringFunction$1((str) => {
  return str.replace(camelizeRE, (_, c) => c ? c.toUpperCase() : "");
});
const hyphenateRE$1 = /\B([A-Z])/g;
const hyphenate$1 = cacheStringFunction$1(
  (str) => str.replace(hyphenateRE$1, "-$1").toLowerCase()
);
const capitalize$1 = cacheStringFunction$1((str) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
});
const toHandlerKey = cacheStringFunction$1((str) => {
  const s = str ? `on${capitalize$1(str)}` : ``;
  return s;
});
const hasChanged = (value, oldValue) => !Object.is(value, oldValue);
const invokeArrayFns$1 = (fns, arg) => {
  for (let i2 = 0; i2 < fns.length; i2++) {
    fns[i2](arg);
  }
};
const def = (obj, key, value) => {
  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: false,
    value
  });
};
const looseToNumber$1 = (val) => {
  const n = parseFloat(val);
  return isNaN(n) ? val : n;
};
let _globalThis;
const getGlobalThis = () => {
  return _globalThis || (_globalThis = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
};
function normalizeStyle(value) {
  if (isArray$2(value)) {
    const res = {};
    for (let i2 = 0; i2 < value.length; i2++) {
      const item = value[i2];
      const normalized = isString$1(item) ? parseStringStyle(item) : normalizeStyle(item);
      if (normalized) {
        for (const key in normalized) {
          res[key] = normalized[key];
        }
      }
    }
    return res;
  } else if (isString$1(value) || isObject$1(value)) {
    return value;
  }
}
const listDelimiterRE = /;(?![^(]*\))/g;
const propertyDelimiterRE = /:([^]+)/;
const styleCommentRE = /\/\*[^]*?\*\//g;
function parseStringStyle(cssText) {
  const ret = {};
  cssText.replace(styleCommentRE, "").split(listDelimiterRE).forEach((item) => {
    if (item) {
      const tmp = item.split(propertyDelimiterRE);
      tmp.length > 1 && (ret[tmp[0].trim()] = tmp[1].trim());
    }
  });
  return ret;
}
function normalizeClass(value) {
  let res = "";
  if (isString$1(value)) {
    res = value;
  } else if (isArray$2(value)) {
    for (let i2 = 0; i2 < value.length; i2++) {
      const normalized = normalizeClass(value[i2]);
      if (normalized) {
        res += normalized + " ";
      }
    }
  } else if (isObject$1(value)) {
    for (const name in value) {
      if (value[name]) {
        res += name + " ";
      }
    }
  }
  return res.trim();
}
const toDisplayString = (val) => {
  return isString$1(val) ? val : val == null ? "" : isArray$2(val) || isObject$1(val) && (val.toString === objectToString$1 || !isFunction$1(val.toString)) ? JSON.stringify(val, replacer, 2) : String(val);
};
const replacer = (_key, val) => {
  if (val && val.__v_isRef) {
    return replacer(_key, val.value);
  } else if (isMap(val)) {
    return {
      [`Map(${val.size})`]: [...val.entries()].reduce(
        (entries, [key, val2], i2) => {
          entries[stringifySymbol(key, i2) + " =>"] = val2;
          return entries;
        },
        {}
      )
    };
  } else if (isSet$1(val)) {
    return {
      [`Set(${val.size})`]: [...val.values()].map((v) => stringifySymbol(v))
    };
  } else if (isSymbol$1(val)) {
    return stringifySymbol(val);
  } else if (isObject$1(val) && !isArray$2(val) && !isPlainObject$1(val)) {
    return String(val);
  }
  return val;
};
const stringifySymbol = (v, i2 = "") => {
  var _a;
  return isSymbol$1(v) ? `Symbol(${(_a = v.description) != null ? _a : i2})` : v;
};
/**
* @vue/runtime-core v3.4.19
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
const stack = [];
function warn$1(msg, ...args) {
  pauseTracking();
  const instance = stack.length ? stack[stack.length - 1].component : null;
  const appWarnHandler = instance && instance.appContext.config.warnHandler;
  const trace = getComponentTrace();
  if (appWarnHandler) {
    callWithErrorHandling(
      appWarnHandler,
      instance,
      11,
      [
        msg + args.join(""),
        instance && instance.proxy,
        trace.map(
          ({ vnode }) => `at <${formatComponentName(instance, vnode.type)}>`
        ).join("\n"),
        trace
      ]
    );
  } else {
    const warnArgs = [`[Vue warn]: ${msg}`, ...args];
    if (trace.length && // avoid spamming console during tests
    true) {
      warnArgs.push(`
`, ...formatTrace(trace));
    }
    console.warn(...warnArgs);
  }
  resetTracking();
}
function getComponentTrace() {
  let currentVNode = stack[stack.length - 1];
  if (!currentVNode) {
    return [];
  }
  const normalizedStack = [];
  while (currentVNode) {
    const last = normalizedStack[0];
    if (last && last.vnode === currentVNode) {
      last.recurseCount++;
    } else {
      normalizedStack.push({
        vnode: currentVNode,
        recurseCount: 0
      });
    }
    const parentInstance = currentVNode.component && currentVNode.component.parent;
    currentVNode = parentInstance && parentInstance.vnode;
  }
  return normalizedStack;
}
function formatTrace(trace) {
  const logs = [];
  trace.forEach((entry, i2) => {
    logs.push(...i2 === 0 ? [] : [`
`], ...formatTraceEntry(entry));
  });
  return logs;
}
function formatTraceEntry({ vnode, recurseCount }) {
  const postfix = recurseCount > 0 ? `... (${recurseCount} recursive calls)` : ``;
  const isRoot = vnode.component ? vnode.component.parent == null : false;
  const open = ` at <${formatComponentName(
    vnode.component,
    vnode.type,
    isRoot
  )}`;
  const close = `>` + postfix;
  return vnode.props ? [open, ...formatProps(vnode.props), close] : [open + close];
}
function formatProps(props) {
  const res = [];
  const keys = Object.keys(props);
  keys.slice(0, 3).forEach((key) => {
    res.push(...formatProp(key, props[key]));
  });
  if (keys.length > 3) {
    res.push(` ...`);
  }
  return res;
}
function formatProp(key, value, raw) {
  if (isString$1(value)) {
    value = JSON.stringify(value);
    return raw ? value : [`${key}=${value}`];
  } else if (typeof value === "number" || typeof value === "boolean" || value == null) {
    return raw ? value : [`${key}=${value}`];
  } else if (isRef(value)) {
    value = formatProp(key, toRaw(value.value), true);
    return raw ? value : [`${key}=Ref<`, value, `>`];
  } else if (isFunction$1(value)) {
    return [`${key}=fn${value.name ? `<${value.name}>` : ``}`];
  } else {
    value = toRaw(value);
    return raw ? value : [`${key}=`, value];
  }
}
function callWithErrorHandling(fn, instance, type, args) {
  try {
    return args ? fn(...args) : fn();
  } catch (err) {
    handleError(err, instance, type);
  }
}
function callWithAsyncErrorHandling(fn, instance, type, args) {
  if (isFunction$1(fn)) {
    const res = callWithErrorHandling(fn, instance, type, args);
    if (res && isPromise(res)) {
      res.catch((err) => {
        handleError(err, instance, type);
      });
    }
    return res;
  }
  const values = [];
  for (let i2 = 0; i2 < fn.length; i2++) {
    values.push(callWithAsyncErrorHandling(fn[i2], instance, type, args));
  }
  return values;
}
function handleError(err, instance, type, throwInDev = true) {
  const contextVNode = instance ? instance.vnode : null;
  if (instance) {
    let cur = instance.parent;
    const exposedInstance = instance.proxy;
    const errorInfo = `https://vuejs.org/error-reference/#runtime-${type}`;
    while (cur) {
      const errorCapturedHooks = cur.ec;
      if (errorCapturedHooks) {
        for (let i2 = 0; i2 < errorCapturedHooks.length; i2++) {
          if (errorCapturedHooks[i2](err, exposedInstance, errorInfo) === false) {
            return;
          }
        }
      }
      cur = cur.parent;
    }
    const appErrorHandler = instance.appContext.config.errorHandler;
    if (appErrorHandler) {
      callWithErrorHandling(
        appErrorHandler,
        null,
        10,
        [err, exposedInstance, errorInfo]
      );
      return;
    }
  }
  logError(err, type, contextVNode, throwInDev);
}
function logError(err, type, contextVNode, throwInDev = true) {
  {
    console.error(err);
  }
}
let isFlushing = false;
let isFlushPending = false;
const queue = [];
let flushIndex = 0;
const pendingPostFlushCbs = [];
let activePostFlushCbs = null;
let postFlushIndex = 0;
const resolvedPromise = /* @__PURE__ */ Promise.resolve();
let currentFlushPromise = null;
function nextTick(fn) {
  const p2 = currentFlushPromise || resolvedPromise;
  return fn ? p2.then(this ? fn.bind(this) : fn) : p2;
}
function findInsertionIndex(id) {
  let start = flushIndex + 1;
  let end = queue.length;
  while (start < end) {
    const middle = start + end >>> 1;
    const middleJob = queue[middle];
    const middleJobId = getId(middleJob);
    if (middleJobId < id || middleJobId === id && middleJob.pre) {
      start = middle + 1;
    } else {
      end = middle;
    }
  }
  return start;
}
function queueJob(job) {
  if (!queue.length || !queue.includes(
    job,
    isFlushing && job.allowRecurse ? flushIndex + 1 : flushIndex
  )) {
    if (job.id == null) {
      queue.push(job);
    } else {
      queue.splice(findInsertionIndex(job.id), 0, job);
    }
    queueFlush();
  }
}
function queueFlush() {
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true;
    currentFlushPromise = resolvedPromise.then(flushJobs);
  }
}
function invalidateJob(job) {
  const i2 = queue.indexOf(job);
  if (i2 > flushIndex) {
    queue.splice(i2, 1);
  }
}
function queuePostFlushCb(cb) {
  if (!isArray$2(cb)) {
    if (!activePostFlushCbs || !activePostFlushCbs.includes(
      cb,
      cb.allowRecurse ? postFlushIndex + 1 : postFlushIndex
    )) {
      pendingPostFlushCbs.push(cb);
    }
  } else {
    pendingPostFlushCbs.push(...cb);
  }
  queueFlush();
}
function flushPreFlushCbs(instance, seen, i2 = isFlushing ? flushIndex + 1 : 0) {
  for (; i2 < queue.length; i2++) {
    const cb = queue[i2];
    if (cb && cb.pre) {
      if (instance && cb.id !== instance.uid) {
        continue;
      }
      queue.splice(i2, 1);
      i2--;
      cb();
    }
  }
}
function flushPostFlushCbs(seen) {
  if (pendingPostFlushCbs.length) {
    const deduped = [...new Set(pendingPostFlushCbs)].sort(
      (a, b) => getId(a) - getId(b)
    );
    pendingPostFlushCbs.length = 0;
    if (activePostFlushCbs) {
      activePostFlushCbs.push(...deduped);
      return;
    }
    activePostFlushCbs = deduped;
    for (postFlushIndex = 0; postFlushIndex < activePostFlushCbs.length; postFlushIndex++) {
      activePostFlushCbs[postFlushIndex]();
    }
    activePostFlushCbs = null;
    postFlushIndex = 0;
  }
}
const getId = (job) => job.id == null ? Infinity : job.id;
const comparator = (a, b) => {
  const diff = getId(a) - getId(b);
  if (diff === 0) {
    if (a.pre && !b.pre)
      return -1;
    if (b.pre && !a.pre)
      return 1;
  }
  return diff;
};
function flushJobs(seen) {
  isFlushPending = false;
  isFlushing = true;
  queue.sort(comparator);
  const check = NOOP;
  try {
    for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
      const job = queue[flushIndex];
      if (job && job.active !== false) {
        if (false)
          ;
        callWithErrorHandling(job, null, 14);
      }
    }
  } finally {
    flushIndex = 0;
    queue.length = 0;
    flushPostFlushCbs();
    isFlushing = false;
    currentFlushPromise = null;
    if (queue.length || pendingPostFlushCbs.length) {
      flushJobs();
    }
  }
}
function emit(instance, event, ...rawArgs) {
  if (instance.isUnmounted)
    return;
  const props = instance.vnode.props || EMPTY_OBJ;
  let args = rawArgs;
  const isModelListener2 = event.startsWith("update:");
  const modelArg = isModelListener2 && event.slice(7);
  if (modelArg && modelArg in props) {
    const modifiersKey = `${modelArg === "modelValue" ? "model" : modelArg}Modifiers`;
    const { number: number2, trim } = props[modifiersKey] || EMPTY_OBJ;
    if (trim) {
      args = rawArgs.map((a) => isString$1(a) ? a.trim() : a);
    }
    if (number2) {
      args = rawArgs.map(looseToNumber$1);
    }
  }
  let handlerName;
  let handler = props[handlerName = toHandlerKey(event)] || // also try camelCase event handler (#2249)
  props[handlerName = toHandlerKey(camelize(event))];
  if (!handler && isModelListener2) {
    handler = props[handlerName = toHandlerKey(hyphenate$1(event))];
  }
  if (handler) {
    callWithAsyncErrorHandling(
      handler,
      instance,
      6,
      args
    );
  }
  const onceHandler = props[handlerName + `Once`];
  if (onceHandler) {
    if (!instance.emitted) {
      instance.emitted = {};
    } else if (instance.emitted[handlerName]) {
      return;
    }
    instance.emitted[handlerName] = true;
    callWithAsyncErrorHandling(
      onceHandler,
      instance,
      6,
      args
    );
  }
}
function normalizeEmitsOptions(comp, appContext, asMixin = false) {
  const cache = appContext.emitsCache;
  const cached = cache.get(comp);
  if (cached !== void 0) {
    return cached;
  }
  const raw = comp.emits;
  let normalized = {};
  let hasExtends = false;
  if (!isFunction$1(comp)) {
    const extendEmits = (raw2) => {
      const normalizedFromExtend = normalizeEmitsOptions(raw2, appContext, true);
      if (normalizedFromExtend) {
        hasExtends = true;
        extend$1(normalized, normalizedFromExtend);
      }
    };
    if (!asMixin && appContext.mixins.length) {
      appContext.mixins.forEach(extendEmits);
    }
    if (comp.extends) {
      extendEmits(comp.extends);
    }
    if (comp.mixins) {
      comp.mixins.forEach(extendEmits);
    }
  }
  if (!raw && !hasExtends) {
    if (isObject$1(comp)) {
      cache.set(comp, null);
    }
    return null;
  }
  if (isArray$2(raw)) {
    raw.forEach((key) => normalized[key] = null);
  } else {
    extend$1(normalized, raw);
  }
  if (isObject$1(comp)) {
    cache.set(comp, normalized);
  }
  return normalized;
}
function isEmitListener(options, key) {
  if (!options || !isOn$1(key)) {
    return false;
  }
  key = key.slice(2).replace(/Once$/, "");
  return hasOwn(options, key[0].toLowerCase() + key.slice(1)) || hasOwn(options, hyphenate$1(key)) || hasOwn(options, key);
}
let currentRenderingInstance = null;
let currentScopeId = null;
function setCurrentRenderingInstance(instance) {
  const prev = currentRenderingInstance;
  currentRenderingInstance = instance;
  currentScopeId = instance && instance.type.__scopeId || null;
  return prev;
}
function pushScopeId(id) {
  currentScopeId = id;
}
function popScopeId() {
  currentScopeId = null;
}
function withCtx(fn, ctx = currentRenderingInstance, isNonScopedSlot) {
  if (!ctx)
    return fn;
  if (fn._n) {
    return fn;
  }
  const renderFnWithContext = (...args) => {
    if (renderFnWithContext._d) {
      setBlockTracking(-1);
    }
    const prevInstance = setCurrentRenderingInstance(ctx);
    let res;
    try {
      res = fn(...args);
    } finally {
      setCurrentRenderingInstance(prevInstance);
      if (renderFnWithContext._d) {
        setBlockTracking(1);
      }
    }
    return res;
  };
  renderFnWithContext._n = true;
  renderFnWithContext._c = true;
  renderFnWithContext._d = true;
  return renderFnWithContext;
}
function markAttrsAccessed() {
}
function renderComponentRoot(instance) {
  const {
    type: Component,
    vnode,
    proxy,
    withProxy,
    props,
    propsOptions: [propsOptions],
    slots,
    attrs,
    emit: emit2,
    render,
    renderCache,
    data,
    setupState,
    ctx,
    inheritAttrs
  } = instance;
  let result;
  let fallthroughAttrs;
  const prev = setCurrentRenderingInstance(instance);
  try {
    if (vnode.shapeFlag & 4) {
      const proxyToUse = withProxy || proxy;
      const thisProxy = false ? new Proxy(proxyToUse, {
        get(target, key, receiver) {
          warn$1(
            `Property '${String(
              key
            )}' was accessed via 'this'. Avoid using 'this' in templates.`
          );
          return Reflect.get(target, key, receiver);
        }
      }) : proxyToUse;
      result = normalizeVNode(
        render.call(
          thisProxy,
          proxyToUse,
          renderCache,
          props,
          setupState,
          data,
          ctx
        )
      );
      fallthroughAttrs = attrs;
    } else {
      const render2 = Component;
      if (false)
        ;
      result = normalizeVNode(
        render2.length > 1 ? render2(
          props,
          false ? {
            get attrs() {
              markAttrsAccessed();
              return attrs;
            },
            slots,
            emit: emit2
          } : { attrs, slots, emit: emit2 }
        ) : render2(
          props,
          null
          /* we know it doesn't need it */
        )
      );
      fallthroughAttrs = Component.props ? attrs : getFunctionalFallthrough(attrs);
    }
  } catch (err) {
    blockStack.length = 0;
    handleError(err, instance, 1);
    result = createVNode(Comment);
  }
  let root = result;
  if (fallthroughAttrs && inheritAttrs !== false) {
    const keys = Object.keys(fallthroughAttrs);
    const { shapeFlag } = root;
    if (keys.length) {
      if (shapeFlag & (1 | 6)) {
        if (propsOptions && keys.some(isModelListener$1)) {
          fallthroughAttrs = filterModelListeners(
            fallthroughAttrs,
            propsOptions
          );
        }
        root = cloneVNode(root, fallthroughAttrs);
      }
    }
  }
  if (vnode.dirs) {
    root = cloneVNode(root);
    root.dirs = root.dirs ? root.dirs.concat(vnode.dirs) : vnode.dirs;
  }
  if (vnode.transition) {
    root.transition = vnode.transition;
  }
  {
    result = root;
  }
  setCurrentRenderingInstance(prev);
  return result;
}
const getFunctionalFallthrough = (attrs) => {
  let res;
  for (const key in attrs) {
    if (key === "class" || key === "style" || isOn$1(key)) {
      (res || (res = {}))[key] = attrs[key];
    }
  }
  return res;
};
const filterModelListeners = (attrs, props) => {
  const res = {};
  for (const key in attrs) {
    if (!isModelListener$1(key) || !(key.slice(9) in props)) {
      res[key] = attrs[key];
    }
  }
  return res;
};
function shouldUpdateComponent(prevVNode, nextVNode, optimized) {
  const { props: prevProps, children: prevChildren, component } = prevVNode;
  const { props: nextProps, children: nextChildren, patchFlag } = nextVNode;
  const emits = component.emitsOptions;
  if (nextVNode.dirs || nextVNode.transition) {
    return true;
  }
  if (optimized && patchFlag >= 0) {
    if (patchFlag & 1024) {
      return true;
    }
    if (patchFlag & 16) {
      if (!prevProps) {
        return !!nextProps;
      }
      return hasPropsChanged(prevProps, nextProps, emits);
    } else if (patchFlag & 8) {
      const dynamicProps = nextVNode.dynamicProps;
      for (let i2 = 0; i2 < dynamicProps.length; i2++) {
        const key = dynamicProps[i2];
        if (nextProps[key] !== prevProps[key] && !isEmitListener(emits, key)) {
          return true;
        }
      }
    }
  } else {
    if (prevChildren || nextChildren) {
      if (!nextChildren || !nextChildren.$stable) {
        return true;
      }
    }
    if (prevProps === nextProps) {
      return false;
    }
    if (!prevProps) {
      return !!nextProps;
    }
    if (!nextProps) {
      return true;
    }
    return hasPropsChanged(prevProps, nextProps, emits);
  }
  return false;
}
function hasPropsChanged(prevProps, nextProps, emitsOptions) {
  const nextKeys = Object.keys(nextProps);
  if (nextKeys.length !== Object.keys(prevProps).length) {
    return true;
  }
  for (let i2 = 0; i2 < nextKeys.length; i2++) {
    const key = nextKeys[i2];
    if (nextProps[key] !== prevProps[key] && !isEmitListener(emitsOptions, key)) {
      return true;
    }
  }
  return false;
}
function updateHOCHostEl({ vnode, parent }, el) {
  while (parent) {
    const root = parent.subTree;
    if (root.suspense && root.suspense.activeBranch === vnode) {
      root.el = vnode.el;
    }
    if (root === vnode) {
      (vnode = parent.vnode).el = el;
      parent = parent.parent;
    } else {
      break;
    }
  }
}
const COMPONENTS = "components";
function resolveComponent(name, maybeSelfReference) {
  return resolveAsset(COMPONENTS, name, true, maybeSelfReference) || name;
}
const NULL_DYNAMIC_COMPONENT = Symbol.for("v-ndc");
function resolveAsset(type, name, warnMissing = true, maybeSelfReference = false) {
  const instance = currentRenderingInstance || currentInstance;
  if (instance) {
    const Component = instance.type;
    if (type === COMPONENTS) {
      const selfName = getComponentName(
        Component,
        false
      );
      if (selfName && (selfName === name || selfName === camelize(name) || selfName === capitalize$1(camelize(name)))) {
        return Component;
      }
    }
    const res = (
      // local registration
      // check instance[type] first which is resolved for options API
      resolve(instance[type] || Component[type], name) || // global registration
      resolve(instance.appContext[type], name)
    );
    if (!res && maybeSelfReference) {
      return Component;
    }
    return res;
  }
}
function resolve(registry, name) {
  return registry && (registry[name] || registry[camelize(name)] || registry[capitalize$1(camelize(name))]);
}
const isSuspense = (type) => type.__isSuspense;
function queueEffectWithSuspense(fn, suspense) {
  if (suspense && suspense.pendingBranch) {
    if (isArray$2(fn)) {
      suspense.effects.push(...fn);
    } else {
      suspense.effects.push(fn);
    }
  } else {
    queuePostFlushCb(fn);
  }
}
const ssrContextKey = Symbol.for("v-scx");
const useSSRContext = () => {
  {
    const ctx = inject(ssrContextKey);
    return ctx;
  }
};
function watchEffect(effect, options) {
  return doWatch(effect, null, options);
}
const INITIAL_WATCHER_VALUE = {};
function watch(source, cb, options) {
  return doWatch(source, cb, options);
}
function doWatch(source, cb, {
  immediate,
  deep,
  flush,
  once,
  onTrack,
  onTrigger
} = EMPTY_OBJ) {
  if (cb && once) {
    const _cb = cb;
    cb = (...args) => {
      _cb(...args);
      unwatch();
    };
  }
  const instance = currentInstance;
  const reactiveGetter = (source2) => deep === true ? source2 : (
    // for deep: false, only traverse root-level properties
    traverse(source2, deep === false ? 1 : void 0)
  );
  let getter;
  let forceTrigger = false;
  let isMultiSource = false;
  if (isRef(source)) {
    getter = () => source.value;
    forceTrigger = isShallow(source);
  } else if (isReactive(source)) {
    getter = () => reactiveGetter(source);
    forceTrigger = true;
  } else if (isArray$2(source)) {
    isMultiSource = true;
    forceTrigger = source.some((s) => isReactive(s) || isShallow(s));
    getter = () => source.map((s) => {
      if (isRef(s)) {
        return s.value;
      } else if (isReactive(s)) {
        return reactiveGetter(s);
      } else if (isFunction$1(s)) {
        return callWithErrorHandling(s, instance, 2);
      } else
        ;
    });
  } else if (isFunction$1(source)) {
    if (cb) {
      getter = () => callWithErrorHandling(source, instance, 2);
    } else {
      getter = () => {
        if (cleanup) {
          cleanup();
        }
        return callWithAsyncErrorHandling(
          source,
          instance,
          3,
          [onCleanup]
        );
      };
    }
  } else {
    getter = NOOP;
  }
  if (cb && deep) {
    const baseGetter = getter;
    getter = () => traverse(baseGetter());
  }
  let cleanup;
  let onCleanup = (fn) => {
    cleanup = effect.onStop = () => {
      callWithErrorHandling(fn, instance, 4);
      cleanup = effect.onStop = void 0;
    };
  };
  let ssrCleanup;
  if (isInSSRComponentSetup) {
    onCleanup = NOOP;
    if (!cb) {
      getter();
    } else if (immediate) {
      callWithAsyncErrorHandling(cb, instance, 3, [
        getter(),
        isMultiSource ? [] : void 0,
        onCleanup
      ]);
    }
    if (flush === "sync") {
      const ctx = useSSRContext();
      ssrCleanup = ctx.__watcherHandles || (ctx.__watcherHandles = []);
    } else {
      return NOOP;
    }
  }
  let oldValue = isMultiSource ? new Array(source.length).fill(INITIAL_WATCHER_VALUE) : INITIAL_WATCHER_VALUE;
  const job = () => {
    if (!effect.active || !effect.dirty) {
      return;
    }
    if (cb) {
      const newValue = effect.run();
      if (deep || forceTrigger || (isMultiSource ? newValue.some((v, i2) => hasChanged(v, oldValue[i2])) : hasChanged(newValue, oldValue)) || false) {
        if (cleanup) {
          cleanup();
        }
        callWithAsyncErrorHandling(cb, instance, 3, [
          newValue,
          // pass undefined as the old value when it's changed for the first time
          oldValue === INITIAL_WATCHER_VALUE ? void 0 : isMultiSource && oldValue[0] === INITIAL_WATCHER_VALUE ? [] : oldValue,
          onCleanup
        ]);
        oldValue = newValue;
      }
    } else {
      effect.run();
    }
  };
  job.allowRecurse = !!cb;
  let scheduler;
  if (flush === "sync") {
    scheduler = job;
  } else if (flush === "post") {
    scheduler = () => queuePostRenderEffect(job, instance && instance.suspense);
  } else {
    job.pre = true;
    if (instance)
      job.id = instance.uid;
    scheduler = () => queueJob(job);
  }
  const effect = new ReactiveEffect(getter, NOOP, scheduler);
  const scope = getCurrentScope();
  const unwatch = () => {
    effect.stop();
    if (scope) {
      remove(scope.effects, effect);
    }
  };
  if (cb) {
    if (immediate) {
      job();
    } else {
      oldValue = effect.run();
    }
  } else if (flush === "post") {
    queuePostRenderEffect(
      effect.run.bind(effect),
      instance && instance.suspense
    );
  } else {
    effect.run();
  }
  if (ssrCleanup)
    ssrCleanup.push(unwatch);
  return unwatch;
}
function instanceWatch(source, value, options) {
  const publicThis = this.proxy;
  const getter = isString$1(source) ? source.includes(".") ? createPathGetter(publicThis, source) : () => publicThis[source] : source.bind(publicThis, publicThis);
  let cb;
  if (isFunction$1(value)) {
    cb = value;
  } else {
    cb = value.handler;
    options = value;
  }
  const reset = setCurrentInstance(this);
  const res = doWatch(getter, cb.bind(publicThis), options);
  reset();
  return res;
}
function createPathGetter(ctx, path) {
  const segments = path.split(".");
  return () => {
    let cur = ctx;
    for (let i2 = 0; i2 < segments.length && cur; i2++) {
      cur = cur[segments[i2]];
    }
    return cur;
  };
}
function traverse(value, depth, currentDepth = 0, seen) {
  if (!isObject$1(value) || value["__v_skip"]) {
    return value;
  }
  if (depth && depth > 0) {
    if (currentDepth >= depth) {
      return value;
    }
    currentDepth++;
  }
  seen = seen || /* @__PURE__ */ new Set();
  if (seen.has(value)) {
    return value;
  }
  seen.add(value);
  if (isRef(value)) {
    traverse(value.value, depth, currentDepth, seen);
  } else if (isArray$2(value)) {
    for (let i2 = 0; i2 < value.length; i2++) {
      traverse(value[i2], depth, currentDepth, seen);
    }
  } else if (isSet$1(value) || isMap(value)) {
    value.forEach((v) => {
      traverse(v, depth, currentDepth, seen);
    });
  } else if (isPlainObject$1(value)) {
    for (const key in value) {
      traverse(value[key], depth, currentDepth, seen);
    }
  }
  return value;
}
function withDirectives(vnode, directives) {
  if (currentRenderingInstance === null) {
    return vnode;
  }
  const instance = getExposeProxy(currentRenderingInstance) || currentRenderingInstance.proxy;
  const bindings = vnode.dirs || (vnode.dirs = []);
  for (let i2 = 0; i2 < directives.length; i2++) {
    let [dir, value, arg, modifiers = EMPTY_OBJ] = directives[i2];
    if (dir) {
      if (isFunction$1(dir)) {
        dir = {
          mounted: dir,
          updated: dir
        };
      }
      if (dir.deep) {
        traverse(value);
      }
      bindings.push({
        dir,
        instance,
        value,
        oldValue: void 0,
        arg,
        modifiers
      });
    }
  }
  return vnode;
}
function invokeDirectiveHook(vnode, prevVNode, instance, name) {
  const bindings = vnode.dirs;
  const oldBindings = prevVNode && prevVNode.dirs;
  for (let i2 = 0; i2 < bindings.length; i2++) {
    const binding = bindings[i2];
    if (oldBindings) {
      binding.oldValue = oldBindings[i2].value;
    }
    let hook = binding.dir[name];
    if (hook) {
      pauseTracking();
      callWithAsyncErrorHandling(hook, instance, 8, [
        vnode.el,
        binding,
        vnode,
        prevVNode
      ]);
      resetTracking();
    }
  }
}
/*! #__NO_SIDE_EFFECTS__ */
// @__NO_SIDE_EFFECTS__
function defineComponent(options, extraOptions) {
  return isFunction$1(options) ? (
    // #8326: extend call and options.name access are considered side-effects
    // by Rollup, so we have to wrap it in a pure-annotated IIFE.
    /* @__PURE__ */ (() => extend$1({ name: options.name }, extraOptions, { setup: options }))()
  ) : options;
}
const isAsyncWrapper = (i2) => !!i2.type.__asyncLoader;
const isKeepAlive = (vnode) => vnode.type.__isKeepAlive;
function onActivated(hook, target) {
  registerKeepAliveHook(hook, "a", target);
}
function onDeactivated(hook, target) {
  registerKeepAliveHook(hook, "da", target);
}
function registerKeepAliveHook(hook, type, target = currentInstance) {
  const wrappedHook = hook.__wdc || (hook.__wdc = () => {
    let current = target;
    while (current) {
      if (current.isDeactivated) {
        return;
      }
      current = current.parent;
    }
    return hook();
  });
  injectHook(type, wrappedHook, target);
  if (target) {
    let current = target.parent;
    while (current && current.parent) {
      if (isKeepAlive(current.parent.vnode)) {
        injectToKeepAliveRoot(wrappedHook, type, target, current);
      }
      current = current.parent;
    }
  }
}
function injectToKeepAliveRoot(hook, type, target, keepAliveRoot) {
  const injected = injectHook(
    type,
    hook,
    keepAliveRoot,
    true
    /* prepend */
  );
  onUnmounted(() => {
    remove(keepAliveRoot[type], injected);
  }, target);
}
function injectHook(type, hook, target = currentInstance, prepend = false) {
  if (target) {
    const hooks = target[type] || (target[type] = []);
    const wrappedHook = hook.__weh || (hook.__weh = (...args) => {
      if (target.isUnmounted) {
        return;
      }
      pauseTracking();
      const reset = setCurrentInstance(target);
      const res = callWithAsyncErrorHandling(hook, target, type, args);
      reset();
      resetTracking();
      return res;
    });
    if (prepend) {
      hooks.unshift(wrappedHook);
    } else {
      hooks.push(wrappedHook);
    }
    return wrappedHook;
  }
}
const createHook = (lifecycle) => (hook, target = currentInstance) => (
  // post-create lifecycle registrations are noops during SSR (except for serverPrefetch)
  (!isInSSRComponentSetup || lifecycle === "sp") && injectHook(lifecycle, (...args) => hook(...args), target)
);
const onBeforeMount = createHook("bm");
const onMounted = createHook("m");
const onBeforeUpdate = createHook("bu");
const onUpdated = createHook("u");
const onBeforeUnmount = createHook("bum");
const onUnmounted = createHook("um");
const onServerPrefetch = createHook("sp");
const onRenderTriggered = createHook(
  "rtg"
);
const onRenderTracked = createHook(
  "rtc"
);
function onErrorCaptured(hook, target = currentInstance) {
  injectHook("ec", hook, target);
}
function renderList(source, renderItem, cache, index) {
  let ret;
  const cached = cache && cache[index];
  if (isArray$2(source) || isString$1(source)) {
    ret = new Array(source.length);
    for (let i2 = 0, l = source.length; i2 < l; i2++) {
      ret[i2] = renderItem(source[i2], i2, void 0, cached && cached[i2]);
    }
  } else if (typeof source === "number") {
    ret = new Array(source);
    for (let i2 = 0; i2 < source; i2++) {
      ret[i2] = renderItem(i2 + 1, i2, void 0, cached && cached[i2]);
    }
  } else if (isObject$1(source)) {
    if (source[Symbol.iterator]) {
      ret = Array.from(
        source,
        (item, i2) => renderItem(item, i2, void 0, cached && cached[i2])
      );
    } else {
      const keys = Object.keys(source);
      ret = new Array(keys.length);
      for (let i2 = 0, l = keys.length; i2 < l; i2++) {
        const key = keys[i2];
        ret[i2] = renderItem(source[key], key, i2, cached && cached[i2]);
      }
    }
  } else {
    ret = [];
  }
  if (cache) {
    cache[index] = ret;
  }
  return ret;
}
function renderSlot(slots, name, props = {}, fallback, noSlotted) {
  if (currentRenderingInstance.isCE || currentRenderingInstance.parent && isAsyncWrapper(currentRenderingInstance.parent) && currentRenderingInstance.parent.isCE) {
    if (name !== "default")
      props.name = name;
    return createVNode("slot", props, fallback && fallback());
  }
  let slot = slots[name];
  if (slot && slot._c) {
    slot._d = false;
  }
  openBlock();
  const validSlotContent = slot && ensureValidVNode(slot(props));
  const rendered = createBlock(
    Fragment,
    {
      key: props.key || // slot content array of a dynamic conditional slot may have a branch
      // key attached in the `createSlots` helper, respect that
      validSlotContent && validSlotContent.key || `_${name}`
    },
    validSlotContent || (fallback ? fallback() : []),
    validSlotContent && slots._ === 1 ? 64 : -2
  );
  if (!noSlotted && rendered.scopeId) {
    rendered.slotScopeIds = [rendered.scopeId + "-s"];
  }
  if (slot && slot._c) {
    slot._d = true;
  }
  return rendered;
}
function ensureValidVNode(vnodes) {
  return vnodes.some((child) => {
    if (!isVNode(child))
      return true;
    if (child.type === Comment)
      return false;
    if (child.type === Fragment && !ensureValidVNode(child.children))
      return false;
    return true;
  }) ? vnodes : null;
}
const getPublicInstance = (i2) => {
  if (!i2)
    return null;
  if (isStatefulComponent(i2))
    return getExposeProxy(i2) || i2.proxy;
  return getPublicInstance(i2.parent);
};
const publicPropertiesMap = (
  // Move PURE marker to new line to workaround compiler discarding it
  // due to type annotation
  /* @__PURE__ */ extend$1(/* @__PURE__ */ Object.create(null), {
    $: (i2) => i2,
    $el: (i2) => i2.vnode.el,
    $data: (i2) => i2.data,
    $props: (i2) => i2.props,
    $attrs: (i2) => i2.attrs,
    $slots: (i2) => i2.slots,
    $refs: (i2) => i2.refs,
    $parent: (i2) => getPublicInstance(i2.parent),
    $root: (i2) => getPublicInstance(i2.root),
    $emit: (i2) => i2.emit,
    $options: (i2) => resolveMergedOptions(i2),
    $forceUpdate: (i2) => i2.f || (i2.f = () => {
      i2.effect.dirty = true;
      queueJob(i2.update);
    }),
    $nextTick: (i2) => i2.n || (i2.n = nextTick.bind(i2.proxy)),
    $watch: (i2) => instanceWatch.bind(i2)
  })
);
const hasSetupBinding = (state, key) => state !== EMPTY_OBJ && !state.__isScriptSetup && hasOwn(state, key);
const PublicInstanceProxyHandlers = {
  get({ _: instance }, key) {
    const { ctx, setupState, data, props, accessCache, type, appContext } = instance;
    let normalizedProps;
    if (key[0] !== "$") {
      const n = accessCache[key];
      if (n !== void 0) {
        switch (n) {
          case 1:
            return setupState[key];
          case 2:
            return data[key];
          case 4:
            return ctx[key];
          case 3:
            return props[key];
        }
      } else if (hasSetupBinding(setupState, key)) {
        accessCache[key] = 1;
        return setupState[key];
      } else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
        accessCache[key] = 2;
        return data[key];
      } else if (
        // only cache other properties when instance has declared (thus stable)
        // props
        (normalizedProps = instance.propsOptions[0]) && hasOwn(normalizedProps, key)
      ) {
        accessCache[key] = 3;
        return props[key];
      } else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
        accessCache[key] = 4;
        return ctx[key];
      } else if (shouldCacheAccess) {
        accessCache[key] = 0;
      }
    }
    const publicGetter = publicPropertiesMap[key];
    let cssModule, globalProperties;
    if (publicGetter) {
      if (key === "$attrs") {
        track(instance, "get", key);
      }
      return publicGetter(instance);
    } else if (
      // css module (injected by vue-loader)
      (cssModule = type.__cssModules) && (cssModule = cssModule[key])
    ) {
      return cssModule;
    } else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
      accessCache[key] = 4;
      return ctx[key];
    } else if (
      // global properties
      globalProperties = appContext.config.globalProperties, hasOwn(globalProperties, key)
    ) {
      {
        return globalProperties[key];
      }
    } else
      ;
  },
  set({ _: instance }, key, value) {
    const { data, setupState, ctx } = instance;
    if (hasSetupBinding(setupState, key)) {
      setupState[key] = value;
      return true;
    } else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
      data[key] = value;
      return true;
    } else if (hasOwn(instance.props, key)) {
      return false;
    }
    if (key[0] === "$" && key.slice(1) in instance) {
      return false;
    } else {
      {
        ctx[key] = value;
      }
    }
    return true;
  },
  has({
    _: { data, setupState, accessCache, ctx, appContext, propsOptions }
  }, key) {
    let normalizedProps;
    return !!accessCache[key] || data !== EMPTY_OBJ && hasOwn(data, key) || hasSetupBinding(setupState, key) || (normalizedProps = propsOptions[0]) && hasOwn(normalizedProps, key) || hasOwn(ctx, key) || hasOwn(publicPropertiesMap, key) || hasOwn(appContext.config.globalProperties, key);
  },
  defineProperty(target, key, descriptor) {
    if (descriptor.get != null) {
      target._.accessCache[key] = 0;
    } else if (hasOwn(descriptor, "value")) {
      this.set(target, key, descriptor.value, null);
    }
    return Reflect.defineProperty(target, key, descriptor);
  }
};
function normalizePropsOrEmits(props) {
  return isArray$2(props) ? props.reduce(
    (normalized, p2) => (normalized[p2] = null, normalized),
    {}
  ) : props;
}
let shouldCacheAccess = true;
function applyOptions(instance) {
  const options = resolveMergedOptions(instance);
  const publicThis = instance.proxy;
  const ctx = instance.ctx;
  shouldCacheAccess = false;
  if (options.beforeCreate) {
    callHook(options.beforeCreate, instance, "bc");
  }
  const {
    // state
    data: dataOptions,
    computed: computedOptions,
    methods,
    watch: watchOptions,
    provide: provideOptions,
    inject: injectOptions,
    // lifecycle
    created,
    beforeMount,
    mounted,
    beforeUpdate,
    updated,
    activated,
    deactivated,
    beforeDestroy,
    beforeUnmount,
    destroyed,
    unmounted,
    render,
    renderTracked,
    renderTriggered,
    errorCaptured,
    serverPrefetch,
    // public API
    expose,
    inheritAttrs,
    // assets
    components,
    directives,
    filters
  } = options;
  const checkDuplicateProperties = null;
  if (injectOptions) {
    resolveInjections(injectOptions, ctx, checkDuplicateProperties);
  }
  if (methods) {
    for (const key in methods) {
      const methodHandler = methods[key];
      if (isFunction$1(methodHandler)) {
        {
          ctx[key] = methodHandler.bind(publicThis);
        }
      }
    }
  }
  if (dataOptions) {
    const data = dataOptions.call(publicThis, publicThis);
    if (!isObject$1(data))
      ;
    else {
      instance.data = reactive(data);
    }
  }
  shouldCacheAccess = true;
  if (computedOptions) {
    for (const key in computedOptions) {
      const opt = computedOptions[key];
      const get2 = isFunction$1(opt) ? opt.bind(publicThis, publicThis) : isFunction$1(opt.get) ? opt.get.bind(publicThis, publicThis) : NOOP;
      const set2 = !isFunction$1(opt) && isFunction$1(opt.set) ? opt.set.bind(publicThis) : NOOP;
      const c = computed({
        get: get2,
        set: set2
      });
      Object.defineProperty(ctx, key, {
        enumerable: true,
        configurable: true,
        get: () => c.value,
        set: (v) => c.value = v
      });
    }
  }
  if (watchOptions) {
    for (const key in watchOptions) {
      createWatcher(watchOptions[key], ctx, publicThis, key);
    }
  }
  if (provideOptions) {
    const provides = isFunction$1(provideOptions) ? provideOptions.call(publicThis) : provideOptions;
    Reflect.ownKeys(provides).forEach((key) => {
      provide(key, provides[key]);
    });
  }
  if (created) {
    callHook(created, instance, "c");
  }
  function registerLifecycleHook(register, hook) {
    if (isArray$2(hook)) {
      hook.forEach((_hook) => register(_hook.bind(publicThis)));
    } else if (hook) {
      register(hook.bind(publicThis));
    }
  }
  registerLifecycleHook(onBeforeMount, beforeMount);
  registerLifecycleHook(onMounted, mounted);
  registerLifecycleHook(onBeforeUpdate, beforeUpdate);
  registerLifecycleHook(onUpdated, updated);
  registerLifecycleHook(onActivated, activated);
  registerLifecycleHook(onDeactivated, deactivated);
  registerLifecycleHook(onErrorCaptured, errorCaptured);
  registerLifecycleHook(onRenderTracked, renderTracked);
  registerLifecycleHook(onRenderTriggered, renderTriggered);
  registerLifecycleHook(onBeforeUnmount, beforeUnmount);
  registerLifecycleHook(onUnmounted, unmounted);
  registerLifecycleHook(onServerPrefetch, serverPrefetch);
  if (isArray$2(expose)) {
    if (expose.length) {
      const exposed = instance.exposed || (instance.exposed = {});
      expose.forEach((key) => {
        Object.defineProperty(exposed, key, {
          get: () => publicThis[key],
          set: (val) => publicThis[key] = val
        });
      });
    } else if (!instance.exposed) {
      instance.exposed = {};
    }
  }
  if (render && instance.render === NOOP) {
    instance.render = render;
  }
  if (inheritAttrs != null) {
    instance.inheritAttrs = inheritAttrs;
  }
  if (components)
    instance.components = components;
  if (directives)
    instance.directives = directives;
}
function resolveInjections(injectOptions, ctx, checkDuplicateProperties = NOOP) {
  if (isArray$2(injectOptions)) {
    injectOptions = normalizeInject(injectOptions);
  }
  for (const key in injectOptions) {
    const opt = injectOptions[key];
    let injected;
    if (isObject$1(opt)) {
      if ("default" in opt) {
        injected = inject(
          opt.from || key,
          opt.default,
          true
        );
      } else {
        injected = inject(opt.from || key);
      }
    } else {
      injected = inject(opt);
    }
    if (isRef(injected)) {
      Object.defineProperty(ctx, key, {
        enumerable: true,
        configurable: true,
        get: () => injected.value,
        set: (v) => injected.value = v
      });
    } else {
      ctx[key] = injected;
    }
  }
}
function callHook(hook, instance, type) {
  callWithAsyncErrorHandling(
    isArray$2(hook) ? hook.map((h2) => h2.bind(instance.proxy)) : hook.bind(instance.proxy),
    instance,
    type
  );
}
function createWatcher(raw, ctx, publicThis, key) {
  const getter = key.includes(".") ? createPathGetter(publicThis, key) : () => publicThis[key];
  if (isString$1(raw)) {
    const handler = ctx[raw];
    if (isFunction$1(handler)) {
      watch(getter, handler);
    }
  } else if (isFunction$1(raw)) {
    watch(getter, raw.bind(publicThis));
  } else if (isObject$1(raw)) {
    if (isArray$2(raw)) {
      raw.forEach((r) => createWatcher(r, ctx, publicThis, key));
    } else {
      const handler = isFunction$1(raw.handler) ? raw.handler.bind(publicThis) : ctx[raw.handler];
      if (isFunction$1(handler)) {
        watch(getter, handler, raw);
      }
    }
  } else
    ;
}
function resolveMergedOptions(instance) {
  const base = instance.type;
  const { mixins, extends: extendsOptions } = base;
  const {
    mixins: globalMixins,
    optionsCache: cache,
    config: { optionMergeStrategies }
  } = instance.appContext;
  const cached = cache.get(base);
  let resolved;
  if (cached) {
    resolved = cached;
  } else if (!globalMixins.length && !mixins && !extendsOptions) {
    {
      resolved = base;
    }
  } else {
    resolved = {};
    if (globalMixins.length) {
      globalMixins.forEach(
        (m) => mergeOptions$1(resolved, m, optionMergeStrategies, true)
      );
    }
    mergeOptions$1(resolved, base, optionMergeStrategies);
  }
  if (isObject$1(base)) {
    cache.set(base, resolved);
  }
  return resolved;
}
function mergeOptions$1(to, from, strats, asMixin = false) {
  const { mixins, extends: extendsOptions } = from;
  if (extendsOptions) {
    mergeOptions$1(to, extendsOptions, strats, true);
  }
  if (mixins) {
    mixins.forEach(
      (m) => mergeOptions$1(to, m, strats, true)
    );
  }
  for (const key in from) {
    if (asMixin && key === "expose")
      ;
    else {
      const strat = internalOptionMergeStrats[key] || strats && strats[key];
      to[key] = strat ? strat(to[key], from[key]) : from[key];
    }
  }
  return to;
}
const internalOptionMergeStrats = {
  data: mergeDataFn,
  props: mergeEmitsOrPropsOptions,
  emits: mergeEmitsOrPropsOptions,
  // objects
  methods: mergeObjectOptions,
  computed: mergeObjectOptions,
  // lifecycle
  beforeCreate: mergeAsArray,
  created: mergeAsArray,
  beforeMount: mergeAsArray,
  mounted: mergeAsArray,
  beforeUpdate: mergeAsArray,
  updated: mergeAsArray,
  beforeDestroy: mergeAsArray,
  beforeUnmount: mergeAsArray,
  destroyed: mergeAsArray,
  unmounted: mergeAsArray,
  activated: mergeAsArray,
  deactivated: mergeAsArray,
  errorCaptured: mergeAsArray,
  serverPrefetch: mergeAsArray,
  // assets
  components: mergeObjectOptions,
  directives: mergeObjectOptions,
  // watch
  watch: mergeWatchOptions,
  // provide / inject
  provide: mergeDataFn,
  inject: mergeInject
};
function mergeDataFn(to, from) {
  if (!from) {
    return to;
  }
  if (!to) {
    return from;
  }
  return function mergedDataFn() {
    return extend$1(
      isFunction$1(to) ? to.call(this, this) : to,
      isFunction$1(from) ? from.call(this, this) : from
    );
  };
}
function mergeInject(to, from) {
  return mergeObjectOptions(normalizeInject(to), normalizeInject(from));
}
function normalizeInject(raw) {
  if (isArray$2(raw)) {
    const res = {};
    for (let i2 = 0; i2 < raw.length; i2++) {
      res[raw[i2]] = raw[i2];
    }
    return res;
  }
  return raw;
}
function mergeAsArray(to, from) {
  return to ? [...new Set([].concat(to, from))] : from;
}
function mergeObjectOptions(to, from) {
  return to ? extend$1(/* @__PURE__ */ Object.create(null), to, from) : from;
}
function mergeEmitsOrPropsOptions(to, from) {
  if (to) {
    if (isArray$2(to) && isArray$2(from)) {
      return [.../* @__PURE__ */ new Set([...to, ...from])];
    }
    return extend$1(
      /* @__PURE__ */ Object.create(null),
      normalizePropsOrEmits(to),
      normalizePropsOrEmits(from != null ? from : {})
    );
  } else {
    return from;
  }
}
function mergeWatchOptions(to, from) {
  if (!to)
    return from;
  if (!from)
    return to;
  const merged = extend$1(/* @__PURE__ */ Object.create(null), to);
  for (const key in from) {
    merged[key] = mergeAsArray(to[key], from[key]);
  }
  return merged;
}
function createAppContext() {
  return {
    app: null,
    config: {
      isNativeTag: NO,
      performance: false,
      globalProperties: {},
      optionMergeStrategies: {},
      errorHandler: void 0,
      warnHandler: void 0,
      compilerOptions: {}
    },
    mixins: [],
    components: {},
    directives: {},
    provides: /* @__PURE__ */ Object.create(null),
    optionsCache: /* @__PURE__ */ new WeakMap(),
    propsCache: /* @__PURE__ */ new WeakMap(),
    emitsCache: /* @__PURE__ */ new WeakMap()
  };
}
let uid$1 = 0;
function createAppAPI(render, hydrate) {
  return function createApp2(rootComponent, rootProps = null) {
    if (!isFunction$1(rootComponent)) {
      rootComponent = extend$1({}, rootComponent);
    }
    if (rootProps != null && !isObject$1(rootProps)) {
      rootProps = null;
    }
    const context = createAppContext();
    const installedPlugins = /* @__PURE__ */ new WeakSet();
    let isMounted = false;
    const app2 = context.app = {
      _uid: uid$1++,
      _component: rootComponent,
      _props: rootProps,
      _container: null,
      _context: context,
      _instance: null,
      version,
      get config() {
        return context.config;
      },
      set config(v) {
      },
      use(plugin, ...options) {
        if (installedPlugins.has(plugin))
          ;
        else if (plugin && isFunction$1(plugin.install)) {
          installedPlugins.add(plugin);
          plugin.install(app2, ...options);
        } else if (isFunction$1(plugin)) {
          installedPlugins.add(plugin);
          plugin(app2, ...options);
        } else
          ;
        return app2;
      },
      mixin(mixin) {
        {
          if (!context.mixins.includes(mixin)) {
            context.mixins.push(mixin);
          }
        }
        return app2;
      },
      component(name, component) {
        if (!component) {
          return context.components[name];
        }
        context.components[name] = component;
        return app2;
      },
      directive(name, directive) {
        if (!directive) {
          return context.directives[name];
        }
        context.directives[name] = directive;
        return app2;
      },
      mount(rootContainer, isHydrate, namespace) {
        if (!isMounted) {
          const vnode = createVNode(rootComponent, rootProps);
          vnode.appContext = context;
          if (namespace === true) {
            namespace = "svg";
          } else if (namespace === false) {
            namespace = void 0;
          }
          if (isHydrate && hydrate) {
            hydrate(vnode, rootContainer);
          } else {
            render(vnode, rootContainer, namespace);
          }
          isMounted = true;
          app2._container = rootContainer;
          rootContainer.__vue_app__ = app2;
          return getExposeProxy(vnode.component) || vnode.component.proxy;
        }
      },
      unmount() {
        if (isMounted) {
          render(null, app2._container);
          delete app2._container.__vue_app__;
        }
      },
      provide(key, value) {
        context.provides[key] = value;
        return app2;
      },
      runWithContext(fn) {
        const lastApp = currentApp;
        currentApp = app2;
        try {
          return fn();
        } finally {
          currentApp = lastApp;
        }
      }
    };
    return app2;
  };
}
let currentApp = null;
function provide(key, value) {
  if (!currentInstance)
    ;
  else {
    let provides = currentInstance.provides;
    const parentProvides = currentInstance.parent && currentInstance.parent.provides;
    if (parentProvides === provides) {
      provides = currentInstance.provides = Object.create(parentProvides);
    }
    provides[key] = value;
  }
}
function inject(key, defaultValue, treatDefaultAsFactory = false) {
  const instance = currentInstance || currentRenderingInstance;
  if (instance || currentApp) {
    const provides = instance ? instance.parent == null ? instance.vnode.appContext && instance.vnode.appContext.provides : instance.parent.provides : currentApp._context.provides;
    if (provides && key in provides) {
      return provides[key];
    } else if (arguments.length > 1) {
      return treatDefaultAsFactory && isFunction$1(defaultValue) ? defaultValue.call(instance && instance.proxy) : defaultValue;
    } else
      ;
  }
}
function hasInjectionContext() {
  return !!(currentInstance || currentRenderingInstance || currentApp);
}
function initProps(instance, rawProps, isStateful, isSSR = false) {
  const props = {};
  const attrs = {};
  def(attrs, InternalObjectKey, 1);
  instance.propsDefaults = /* @__PURE__ */ Object.create(null);
  setFullProps(instance, rawProps, props, attrs);
  for (const key in instance.propsOptions[0]) {
    if (!(key in props)) {
      props[key] = void 0;
    }
  }
  if (isStateful) {
    instance.props = isSSR ? props : shallowReactive(props);
  } else {
    if (!instance.type.props) {
      instance.props = attrs;
    } else {
      instance.props = props;
    }
  }
  instance.attrs = attrs;
}
function updateProps(instance, rawProps, rawPrevProps, optimized) {
  const {
    props,
    attrs,
    vnode: { patchFlag }
  } = instance;
  const rawCurrentProps = toRaw(props);
  const [options] = instance.propsOptions;
  let hasAttrsChanged = false;
  if (
    // always force full diff in dev
    // - #1942 if hmr is enabled with sfc component
    // - vite#872 non-sfc component used by sfc component
    (optimized || patchFlag > 0) && !(patchFlag & 16)
  ) {
    if (patchFlag & 8) {
      const propsToUpdate = instance.vnode.dynamicProps;
      for (let i2 = 0; i2 < propsToUpdate.length; i2++) {
        let key = propsToUpdate[i2];
        if (isEmitListener(instance.emitsOptions, key)) {
          continue;
        }
        const value = rawProps[key];
        if (options) {
          if (hasOwn(attrs, key)) {
            if (value !== attrs[key]) {
              attrs[key] = value;
              hasAttrsChanged = true;
            }
          } else {
            const camelizedKey = camelize(key);
            props[camelizedKey] = resolvePropValue(
              options,
              rawCurrentProps,
              camelizedKey,
              value,
              instance,
              false
            );
          }
        } else {
          if (value !== attrs[key]) {
            attrs[key] = value;
            hasAttrsChanged = true;
          }
        }
      }
    }
  } else {
    if (setFullProps(instance, rawProps, props, attrs)) {
      hasAttrsChanged = true;
    }
    let kebabKey;
    for (const key in rawCurrentProps) {
      if (!rawProps || // for camelCase
      !hasOwn(rawProps, key) && // it's possible the original props was passed in as kebab-case
      // and converted to camelCase (#955)
      ((kebabKey = hyphenate$1(key)) === key || !hasOwn(rawProps, kebabKey))) {
        if (options) {
          if (rawPrevProps && // for camelCase
          (rawPrevProps[key] !== void 0 || // for kebab-case
          rawPrevProps[kebabKey] !== void 0)) {
            props[key] = resolvePropValue(
              options,
              rawCurrentProps,
              key,
              void 0,
              instance,
              true
            );
          }
        } else {
          delete props[key];
        }
      }
    }
    if (attrs !== rawCurrentProps) {
      for (const key in attrs) {
        if (!rawProps || !hasOwn(rawProps, key) && true) {
          delete attrs[key];
          hasAttrsChanged = true;
        }
      }
    }
  }
  if (hasAttrsChanged) {
    trigger(instance, "set", "$attrs");
  }
}
function setFullProps(instance, rawProps, props, attrs) {
  const [options, needCastKeys] = instance.propsOptions;
  let hasAttrsChanged = false;
  let rawCastValues;
  if (rawProps) {
    for (let key in rawProps) {
      if (isReservedProp(key)) {
        continue;
      }
      const value = rawProps[key];
      let camelKey;
      if (options && hasOwn(options, camelKey = camelize(key))) {
        if (!needCastKeys || !needCastKeys.includes(camelKey)) {
          props[camelKey] = value;
        } else {
          (rawCastValues || (rawCastValues = {}))[camelKey] = value;
        }
      } else if (!isEmitListener(instance.emitsOptions, key)) {
        if (!(key in attrs) || value !== attrs[key]) {
          attrs[key] = value;
          hasAttrsChanged = true;
        }
      }
    }
  }
  if (needCastKeys) {
    const rawCurrentProps = toRaw(props);
    const castValues = rawCastValues || EMPTY_OBJ;
    for (let i2 = 0; i2 < needCastKeys.length; i2++) {
      const key = needCastKeys[i2];
      props[key] = resolvePropValue(
        options,
        rawCurrentProps,
        key,
        castValues[key],
        instance,
        !hasOwn(castValues, key)
      );
    }
  }
  return hasAttrsChanged;
}
function resolvePropValue(options, props, key, value, instance, isAbsent) {
  const opt = options[key];
  if (opt != null) {
    const hasDefault = hasOwn(opt, "default");
    if (hasDefault && value === void 0) {
      const defaultValue = opt.default;
      if (opt.type !== Function && !opt.skipFactory && isFunction$1(defaultValue)) {
        const { propsDefaults } = instance;
        if (key in propsDefaults) {
          value = propsDefaults[key];
        } else {
          const reset = setCurrentInstance(instance);
          value = propsDefaults[key] = defaultValue.call(
            null,
            props
          );
          reset();
        }
      } else {
        value = defaultValue;
      }
    }
    if (opt[
      0
      /* shouldCast */
    ]) {
      if (isAbsent && !hasDefault) {
        value = false;
      } else if (opt[
        1
        /* shouldCastTrue */
      ] && (value === "" || value === hyphenate$1(key))) {
        value = true;
      }
    }
  }
  return value;
}
function normalizePropsOptions(comp, appContext, asMixin = false) {
  const cache = appContext.propsCache;
  const cached = cache.get(comp);
  if (cached) {
    return cached;
  }
  const raw = comp.props;
  const normalized = {};
  const needCastKeys = [];
  let hasExtends = false;
  if (!isFunction$1(comp)) {
    const extendProps = (raw2) => {
      hasExtends = true;
      const [props, keys] = normalizePropsOptions(raw2, appContext, true);
      extend$1(normalized, props);
      if (keys)
        needCastKeys.push(...keys);
    };
    if (!asMixin && appContext.mixins.length) {
      appContext.mixins.forEach(extendProps);
    }
    if (comp.extends) {
      extendProps(comp.extends);
    }
    if (comp.mixins) {
      comp.mixins.forEach(extendProps);
    }
  }
  if (!raw && !hasExtends) {
    if (isObject$1(comp)) {
      cache.set(comp, EMPTY_ARR);
    }
    return EMPTY_ARR;
  }
  if (isArray$2(raw)) {
    for (let i2 = 0; i2 < raw.length; i2++) {
      const normalizedKey = camelize(raw[i2]);
      if (validatePropName(normalizedKey)) {
        normalized[normalizedKey] = EMPTY_OBJ;
      }
    }
  } else if (raw) {
    for (const key in raw) {
      const normalizedKey = camelize(key);
      if (validatePropName(normalizedKey)) {
        const opt = raw[key];
        const prop = normalized[normalizedKey] = isArray$2(opt) || isFunction$1(opt) ? { type: opt } : extend$1({}, opt);
        if (prop) {
          const booleanIndex = getTypeIndex(Boolean, prop.type);
          const stringIndex = getTypeIndex(String, prop.type);
          prop[
            0
            /* shouldCast */
          ] = booleanIndex > -1;
          prop[
            1
            /* shouldCastTrue */
          ] = stringIndex < 0 || booleanIndex < stringIndex;
          if (booleanIndex > -1 || hasOwn(prop, "default")) {
            needCastKeys.push(normalizedKey);
          }
        }
      }
    }
  }
  const res = [normalized, needCastKeys];
  if (isObject$1(comp)) {
    cache.set(comp, res);
  }
  return res;
}
function validatePropName(key) {
  if (key[0] !== "$" && !isReservedProp(key)) {
    return true;
  }
  return false;
}
function getType(ctor) {
  if (ctor === null) {
    return "null";
  }
  if (typeof ctor === "function") {
    return ctor.name || "";
  } else if (typeof ctor === "object") {
    const name = ctor.constructor && ctor.constructor.name;
    return name || "";
  }
  return "";
}
function isSameType(a, b) {
  return getType(a) === getType(b);
}
function getTypeIndex(type, expectedTypes) {
  if (isArray$2(expectedTypes)) {
    return expectedTypes.findIndex((t) => isSameType(t, type));
  } else if (isFunction$1(expectedTypes)) {
    return isSameType(expectedTypes, type) ? 0 : -1;
  }
  return -1;
}
const isInternalKey = (key) => key[0] === "_" || key === "$stable";
const normalizeSlotValue = (value) => isArray$2(value) ? value.map(normalizeVNode) : [normalizeVNode(value)];
const normalizeSlot$1 = (key, rawSlot, ctx) => {
  if (rawSlot._n) {
    return rawSlot;
  }
  const normalized = withCtx((...args) => {
    if (false)
      ;
    return normalizeSlotValue(rawSlot(...args));
  }, ctx);
  normalized._c = false;
  return normalized;
};
const normalizeObjectSlots = (rawSlots, slots, instance) => {
  const ctx = rawSlots._ctx;
  for (const key in rawSlots) {
    if (isInternalKey(key))
      continue;
    const value = rawSlots[key];
    if (isFunction$1(value)) {
      slots[key] = normalizeSlot$1(key, value, ctx);
    } else if (value != null) {
      const normalized = normalizeSlotValue(value);
      slots[key] = () => normalized;
    }
  }
};
const normalizeVNodeSlots = (instance, children) => {
  const normalized = normalizeSlotValue(children);
  instance.slots.default = () => normalized;
};
const initSlots = (instance, children) => {
  if (instance.vnode.shapeFlag & 32) {
    const type = children._;
    if (type) {
      instance.slots = toRaw(children);
      def(children, "_", type);
    } else {
      normalizeObjectSlots(
        children,
        instance.slots = {}
      );
    }
  } else {
    instance.slots = {};
    if (children) {
      normalizeVNodeSlots(instance, children);
    }
  }
  def(instance.slots, InternalObjectKey, 1);
};
const updateSlots = (instance, children, optimized) => {
  const { vnode, slots } = instance;
  let needDeletionCheck = true;
  let deletionComparisonTarget = EMPTY_OBJ;
  if (vnode.shapeFlag & 32) {
    const type = children._;
    if (type) {
      if (optimized && type === 1) {
        needDeletionCheck = false;
      } else {
        extend$1(slots, children);
        if (!optimized && type === 1) {
          delete slots._;
        }
      }
    } else {
      needDeletionCheck = !children.$stable;
      normalizeObjectSlots(children, slots);
    }
    deletionComparisonTarget = children;
  } else if (children) {
    normalizeVNodeSlots(instance, children);
    deletionComparisonTarget = { default: 1 };
  }
  if (needDeletionCheck) {
    for (const key in slots) {
      if (!isInternalKey(key) && deletionComparisonTarget[key] == null) {
        delete slots[key];
      }
    }
  }
};
function setRef(rawRef, oldRawRef, parentSuspense, vnode, isUnmount = false) {
  if (isArray$2(rawRef)) {
    rawRef.forEach(
      (r, i2) => setRef(
        r,
        oldRawRef && (isArray$2(oldRawRef) ? oldRawRef[i2] : oldRawRef),
        parentSuspense,
        vnode,
        isUnmount
      )
    );
    return;
  }
  if (isAsyncWrapper(vnode) && !isUnmount) {
    return;
  }
  const refValue = vnode.shapeFlag & 4 ? getExposeProxy(vnode.component) || vnode.component.proxy : vnode.el;
  const value = isUnmount ? null : refValue;
  const { i: owner, r: ref2 } = rawRef;
  const oldRef = oldRawRef && oldRawRef.r;
  const refs = owner.refs === EMPTY_OBJ ? owner.refs = {} : owner.refs;
  const setupState = owner.setupState;
  if (oldRef != null && oldRef !== ref2) {
    if (isString$1(oldRef)) {
      refs[oldRef] = null;
      if (hasOwn(setupState, oldRef)) {
        setupState[oldRef] = null;
      }
    } else if (isRef(oldRef)) {
      oldRef.value = null;
    }
  }
  if (isFunction$1(ref2)) {
    callWithErrorHandling(ref2, owner, 12, [value, refs]);
  } else {
    const _isString = isString$1(ref2);
    const _isRef = isRef(ref2);
    if (_isString || _isRef) {
      const doSet = () => {
        if (rawRef.f) {
          const existing = _isString ? hasOwn(setupState, ref2) ? setupState[ref2] : refs[ref2] : ref2.value;
          if (isUnmount) {
            isArray$2(existing) && remove(existing, refValue);
          } else {
            if (!isArray$2(existing)) {
              if (_isString) {
                refs[ref2] = [refValue];
                if (hasOwn(setupState, ref2)) {
                  setupState[ref2] = refs[ref2];
                }
              } else {
                ref2.value = [refValue];
                if (rawRef.k)
                  refs[rawRef.k] = ref2.value;
              }
            } else if (!existing.includes(refValue)) {
              existing.push(refValue);
            }
          }
        } else if (_isString) {
          refs[ref2] = value;
          if (hasOwn(setupState, ref2)) {
            setupState[ref2] = value;
          }
        } else if (_isRef) {
          ref2.value = value;
          if (rawRef.k)
            refs[rawRef.k] = value;
        } else
          ;
      };
      if (value) {
        doSet.id = -1;
        queuePostRenderEffect(doSet, parentSuspense);
      } else {
        doSet();
      }
    }
  }
}
const queuePostRenderEffect = queueEffectWithSuspense;
function createRenderer(options) {
  return baseCreateRenderer(options);
}
function baseCreateRenderer(options, createHydrationFns) {
  const target = getGlobalThis();
  target.__VUE__ = true;
  const {
    insert: hostInsert,
    remove: hostRemove,
    patchProp: hostPatchProp,
    createElement: hostCreateElement,
    createText: hostCreateText,
    createComment: hostCreateComment,
    setText: hostSetText,
    setElementText: hostSetElementText,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling,
    setScopeId: hostSetScopeId = NOOP,
    insertStaticContent: hostInsertStaticContent
  } = options;
  const patch = (n1, n2, container, anchor = null, parentComponent = null, parentSuspense = null, namespace = void 0, slotScopeIds = null, optimized = !!n2.dynamicChildren) => {
    if (n1 === n2) {
      return;
    }
    if (n1 && !isSameVNodeType(n1, n2)) {
      anchor = getNextHostNode(n1);
      unmount(n1, parentComponent, parentSuspense, true);
      n1 = null;
    }
    if (n2.patchFlag === -2) {
      optimized = false;
      n2.dynamicChildren = null;
    }
    const { type, ref: ref2, shapeFlag } = n2;
    switch (type) {
      case Text:
        processText(n1, n2, container, anchor);
        break;
      case Comment:
        processCommentNode(n1, n2, container, anchor);
        break;
      case Static:
        if (n1 == null) {
          mountStaticNode(n2, container, anchor, namespace);
        }
        break;
      case Fragment:
        processFragment(
          n1,
          n2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        );
        break;
      default:
        if (shapeFlag & 1) {
          processElement(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        } else if (shapeFlag & 6) {
          processComponent(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        } else if (shapeFlag & 64) {
          type.process(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized,
            internals
          );
        } else if (shapeFlag & 128) {
          type.process(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized,
            internals
          );
        } else
          ;
    }
    if (ref2 != null && parentComponent) {
      setRef(ref2, n1 && n1.ref, parentSuspense, n2 || n1, !n2);
    }
  };
  const processText = (n1, n2, container, anchor) => {
    if (n1 == null) {
      hostInsert(
        n2.el = hostCreateText(n2.children),
        container,
        anchor
      );
    } else {
      const el = n2.el = n1.el;
      if (n2.children !== n1.children) {
        hostSetText(el, n2.children);
      }
    }
  };
  const processCommentNode = (n1, n2, container, anchor) => {
    if (n1 == null) {
      hostInsert(
        n2.el = hostCreateComment(n2.children || ""),
        container,
        anchor
      );
    } else {
      n2.el = n1.el;
    }
  };
  const mountStaticNode = (n2, container, anchor, namespace) => {
    [n2.el, n2.anchor] = hostInsertStaticContent(
      n2.children,
      container,
      anchor,
      namespace,
      n2.el,
      n2.anchor
    );
  };
  const moveStaticNode = ({ el, anchor }, container, nextSibling) => {
    let next;
    while (el && el !== anchor) {
      next = hostNextSibling(el);
      hostInsert(el, container, nextSibling);
      el = next;
    }
    hostInsert(anchor, container, nextSibling);
  };
  const removeStaticNode = ({ el, anchor }) => {
    let next;
    while (el && el !== anchor) {
      next = hostNextSibling(el);
      hostRemove(el);
      el = next;
    }
    hostRemove(anchor);
  };
  const processElement = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
    if (n2.type === "svg") {
      namespace = "svg";
    } else if (n2.type === "math") {
      namespace = "mathml";
    }
    if (n1 == null) {
      mountElement(
        n2,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        namespace,
        slotScopeIds,
        optimized
      );
    } else {
      patchElement(
        n1,
        n2,
        parentComponent,
        parentSuspense,
        namespace,
        slotScopeIds,
        optimized
      );
    }
  };
  const mountElement = (vnode, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
    let el;
    let vnodeHook;
    const { props, shapeFlag, transition, dirs } = vnode;
    el = vnode.el = hostCreateElement(
      vnode.type,
      namespace,
      props && props.is,
      props
    );
    if (shapeFlag & 8) {
      hostSetElementText(el, vnode.children);
    } else if (shapeFlag & 16) {
      mountChildren(
        vnode.children,
        el,
        null,
        parentComponent,
        parentSuspense,
        resolveChildrenNamespace(vnode, namespace),
        slotScopeIds,
        optimized
      );
    }
    if (dirs) {
      invokeDirectiveHook(vnode, null, parentComponent, "created");
    }
    setScopeId(el, vnode, vnode.scopeId, slotScopeIds, parentComponent);
    if (props) {
      for (const key in props) {
        if (key !== "value" && !isReservedProp(key)) {
          hostPatchProp(
            el,
            key,
            null,
            props[key],
            namespace,
            vnode.children,
            parentComponent,
            parentSuspense,
            unmountChildren
          );
        }
      }
      if ("value" in props) {
        hostPatchProp(el, "value", null, props.value, namespace);
      }
      if (vnodeHook = props.onVnodeBeforeMount) {
        invokeVNodeHook(vnodeHook, parentComponent, vnode);
      }
    }
    if (dirs) {
      invokeDirectiveHook(vnode, null, parentComponent, "beforeMount");
    }
    const needCallTransitionHooks = needTransition(parentSuspense, transition);
    if (needCallTransitionHooks) {
      transition.beforeEnter(el);
    }
    hostInsert(el, container, anchor);
    if ((vnodeHook = props && props.onVnodeMounted) || needCallTransitionHooks || dirs) {
      queuePostRenderEffect(() => {
        vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode);
        needCallTransitionHooks && transition.enter(el);
        dirs && invokeDirectiveHook(vnode, null, parentComponent, "mounted");
      }, parentSuspense);
    }
  };
  const setScopeId = (el, vnode, scopeId, slotScopeIds, parentComponent) => {
    if (scopeId) {
      hostSetScopeId(el, scopeId);
    }
    if (slotScopeIds) {
      for (let i2 = 0; i2 < slotScopeIds.length; i2++) {
        hostSetScopeId(el, slotScopeIds[i2]);
      }
    }
    if (parentComponent) {
      let subTree = parentComponent.subTree;
      if (vnode === subTree) {
        const parentVNode = parentComponent.vnode;
        setScopeId(
          el,
          parentVNode,
          parentVNode.scopeId,
          parentVNode.slotScopeIds,
          parentComponent.parent
        );
      }
    }
  };
  const mountChildren = (children, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, start = 0) => {
    for (let i2 = start; i2 < children.length; i2++) {
      const child = children[i2] = optimized ? cloneIfMounted(children[i2]) : normalizeVNode(children[i2]);
      patch(
        null,
        child,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        namespace,
        slotScopeIds,
        optimized
      );
    }
  };
  const patchElement = (n1, n2, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
    const el = n2.el = n1.el;
    let { patchFlag, dynamicChildren, dirs } = n2;
    patchFlag |= n1.patchFlag & 16;
    const oldProps = n1.props || EMPTY_OBJ;
    const newProps = n2.props || EMPTY_OBJ;
    let vnodeHook;
    parentComponent && toggleRecurse(parentComponent, false);
    if (vnodeHook = newProps.onVnodeBeforeUpdate) {
      invokeVNodeHook(vnodeHook, parentComponent, n2, n1);
    }
    if (dirs) {
      invokeDirectiveHook(n2, n1, parentComponent, "beforeUpdate");
    }
    parentComponent && toggleRecurse(parentComponent, true);
    if (dynamicChildren) {
      patchBlockChildren(
        n1.dynamicChildren,
        dynamicChildren,
        el,
        parentComponent,
        parentSuspense,
        resolveChildrenNamespace(n2, namespace),
        slotScopeIds
      );
    } else if (!optimized) {
      patchChildren(
        n1,
        n2,
        el,
        null,
        parentComponent,
        parentSuspense,
        resolveChildrenNamespace(n2, namespace),
        slotScopeIds,
        false
      );
    }
    if (patchFlag > 0) {
      if (patchFlag & 16) {
        patchProps(
          el,
          n2,
          oldProps,
          newProps,
          parentComponent,
          parentSuspense,
          namespace
        );
      } else {
        if (patchFlag & 2) {
          if (oldProps.class !== newProps.class) {
            hostPatchProp(el, "class", null, newProps.class, namespace);
          }
        }
        if (patchFlag & 4) {
          hostPatchProp(el, "style", oldProps.style, newProps.style, namespace);
        }
        if (patchFlag & 8) {
          const propsToUpdate = n2.dynamicProps;
          for (let i2 = 0; i2 < propsToUpdate.length; i2++) {
            const key = propsToUpdate[i2];
            const prev = oldProps[key];
            const next = newProps[key];
            if (next !== prev || key === "value") {
              hostPatchProp(
                el,
                key,
                prev,
                next,
                namespace,
                n1.children,
                parentComponent,
                parentSuspense,
                unmountChildren
              );
            }
          }
        }
      }
      if (patchFlag & 1) {
        if (n1.children !== n2.children) {
          hostSetElementText(el, n2.children);
        }
      }
    } else if (!optimized && dynamicChildren == null) {
      patchProps(
        el,
        n2,
        oldProps,
        newProps,
        parentComponent,
        parentSuspense,
        namespace
      );
    }
    if ((vnodeHook = newProps.onVnodeUpdated) || dirs) {
      queuePostRenderEffect(() => {
        vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, n2, n1);
        dirs && invokeDirectiveHook(n2, n1, parentComponent, "updated");
      }, parentSuspense);
    }
  };
  const patchBlockChildren = (oldChildren, newChildren, fallbackContainer, parentComponent, parentSuspense, namespace, slotScopeIds) => {
    for (let i2 = 0; i2 < newChildren.length; i2++) {
      const oldVNode = oldChildren[i2];
      const newVNode = newChildren[i2];
      const container = (
        // oldVNode may be an errored async setup() component inside Suspense
        // which will not have a mounted element
        oldVNode.el && // - In the case of a Fragment, we need to provide the actual parent
        // of the Fragment itself so it can move its children.
        (oldVNode.type === Fragment || // - In the case of different nodes, there is going to be a replacement
        // which also requires the correct parent container
        !isSameVNodeType(oldVNode, newVNode) || // - In the case of a component, it could contain anything.
        oldVNode.shapeFlag & (6 | 64)) ? hostParentNode(oldVNode.el) : (
          // In other cases, the parent container is not actually used so we
          // just pass the block element here to avoid a DOM parentNode call.
          fallbackContainer
        )
      );
      patch(
        oldVNode,
        newVNode,
        container,
        null,
        parentComponent,
        parentSuspense,
        namespace,
        slotScopeIds,
        true
      );
    }
  };
  const patchProps = (el, vnode, oldProps, newProps, parentComponent, parentSuspense, namespace) => {
    if (oldProps !== newProps) {
      if (oldProps !== EMPTY_OBJ) {
        for (const key in oldProps) {
          if (!isReservedProp(key) && !(key in newProps)) {
            hostPatchProp(
              el,
              key,
              oldProps[key],
              null,
              namespace,
              vnode.children,
              parentComponent,
              parentSuspense,
              unmountChildren
            );
          }
        }
      }
      for (const key in newProps) {
        if (isReservedProp(key))
          continue;
        const next = newProps[key];
        const prev = oldProps[key];
        if (next !== prev && key !== "value") {
          hostPatchProp(
            el,
            key,
            prev,
            next,
            namespace,
            vnode.children,
            parentComponent,
            parentSuspense,
            unmountChildren
          );
        }
      }
      if ("value" in newProps) {
        hostPatchProp(el, "value", oldProps.value, newProps.value, namespace);
      }
    }
  };
  const processFragment = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
    const fragmentStartAnchor = n2.el = n1 ? n1.el : hostCreateText("");
    const fragmentEndAnchor = n2.anchor = n1 ? n1.anchor : hostCreateText("");
    let { patchFlag, dynamicChildren, slotScopeIds: fragmentSlotScopeIds } = n2;
    if (fragmentSlotScopeIds) {
      slotScopeIds = slotScopeIds ? slotScopeIds.concat(fragmentSlotScopeIds) : fragmentSlotScopeIds;
    }
    if (n1 == null) {
      hostInsert(fragmentStartAnchor, container, anchor);
      hostInsert(fragmentEndAnchor, container, anchor);
      mountChildren(
        // #10007
        // such fragment like `<></>` will be compiled into
        // a fragment which doesn't have a children.
        // In this case fallback to an empty array
        n2.children || [],
        container,
        fragmentEndAnchor,
        parentComponent,
        parentSuspense,
        namespace,
        slotScopeIds,
        optimized
      );
    } else {
      if (patchFlag > 0 && patchFlag & 64 && dynamicChildren && // #2715 the previous fragment could've been a BAILed one as a result
      // of renderSlot() with no valid children
      n1.dynamicChildren) {
        patchBlockChildren(
          n1.dynamicChildren,
          dynamicChildren,
          container,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds
        );
        if (
          // #2080 if the stable fragment has a key, it's a <template v-for> that may
          //  get moved around. Make sure all root level vnodes inherit el.
          // #2134 or if it's a component root, it may also get moved around
          // as the component is being moved.
          n2.key != null || parentComponent && n2 === parentComponent.subTree
        ) {
          traverseStaticChildren(
            n1,
            n2,
            true
            /* shallow */
          );
        }
      } else {
        patchChildren(
          n1,
          n2,
          container,
          fragmentEndAnchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        );
      }
    }
  };
  const processComponent = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
    n2.slotScopeIds = slotScopeIds;
    if (n1 == null) {
      if (n2.shapeFlag & 512) {
        parentComponent.ctx.activate(
          n2,
          container,
          anchor,
          namespace,
          optimized
        );
      } else {
        mountComponent(
          n2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          namespace,
          optimized
        );
      }
    } else {
      updateComponent(n1, n2, optimized);
    }
  };
  const mountComponent = (initialVNode, container, anchor, parentComponent, parentSuspense, namespace, optimized) => {
    const instance = initialVNode.component = createComponentInstance(
      initialVNode,
      parentComponent,
      parentSuspense
    );
    if (isKeepAlive(initialVNode)) {
      instance.ctx.renderer = internals;
    }
    {
      setupComponent(instance);
    }
    if (instance.asyncDep) {
      parentSuspense && parentSuspense.registerDep(instance, setupRenderEffect);
      if (!initialVNode.el) {
        const placeholder = instance.subTree = createVNode(Comment);
        processCommentNode(null, placeholder, container, anchor);
      }
    } else {
      setupRenderEffect(
        instance,
        initialVNode,
        container,
        anchor,
        parentSuspense,
        namespace,
        optimized
      );
    }
  };
  const updateComponent = (n1, n2, optimized) => {
    const instance = n2.component = n1.component;
    if (shouldUpdateComponent(n1, n2, optimized)) {
      if (instance.asyncDep && !instance.asyncResolved) {
        updateComponentPreRender(instance, n2, optimized);
        return;
      } else {
        instance.next = n2;
        invalidateJob(instance.update);
        instance.effect.dirty = true;
        instance.update();
      }
    } else {
      n2.el = n1.el;
      instance.vnode = n2;
    }
  };
  const setupRenderEffect = (instance, initialVNode, container, anchor, parentSuspense, namespace, optimized) => {
    const componentUpdateFn = () => {
      if (!instance.isMounted) {
        let vnodeHook;
        const { el, props } = initialVNode;
        const { bm, m, parent } = instance;
        const isAsyncWrapperVNode = isAsyncWrapper(initialVNode);
        toggleRecurse(instance, false);
        if (bm) {
          invokeArrayFns$1(bm);
        }
        if (!isAsyncWrapperVNode && (vnodeHook = props && props.onVnodeBeforeMount)) {
          invokeVNodeHook(vnodeHook, parent, initialVNode);
        }
        toggleRecurse(instance, true);
        if (el && hydrateNode) {
          const hydrateSubTree = () => {
            instance.subTree = renderComponentRoot(instance);
            hydrateNode(
              el,
              instance.subTree,
              instance,
              parentSuspense,
              null
            );
          };
          if (isAsyncWrapperVNode) {
            initialVNode.type.__asyncLoader().then(
              // note: we are moving the render call into an async callback,
              // which means it won't track dependencies - but it's ok because
              // a server-rendered async wrapper is already in resolved state
              // and it will never need to change.
              () => !instance.isUnmounted && hydrateSubTree()
            );
          } else {
            hydrateSubTree();
          }
        } else {
          const subTree = instance.subTree = renderComponentRoot(instance);
          patch(
            null,
            subTree,
            container,
            anchor,
            instance,
            parentSuspense,
            namespace
          );
          initialVNode.el = subTree.el;
        }
        if (m) {
          queuePostRenderEffect(m, parentSuspense);
        }
        if (!isAsyncWrapperVNode && (vnodeHook = props && props.onVnodeMounted)) {
          const scopedInitialVNode = initialVNode;
          queuePostRenderEffect(
            () => invokeVNodeHook(vnodeHook, parent, scopedInitialVNode),
            parentSuspense
          );
        }
        if (initialVNode.shapeFlag & 256 || parent && isAsyncWrapper(parent.vnode) && parent.vnode.shapeFlag & 256) {
          instance.a && queuePostRenderEffect(instance.a, parentSuspense);
        }
        instance.isMounted = true;
        initialVNode = container = anchor = null;
      } else {
        let { next, bu, u: u2, parent, vnode } = instance;
        {
          const nonHydratedAsyncRoot = locateNonHydratedAsyncRoot(instance);
          if (nonHydratedAsyncRoot) {
            if (next) {
              next.el = vnode.el;
              updateComponentPreRender(instance, next, optimized);
            }
            nonHydratedAsyncRoot.asyncDep.then(() => {
              if (!instance.isUnmounted) {
                componentUpdateFn();
              }
            });
            return;
          }
        }
        let originNext = next;
        let vnodeHook;
        toggleRecurse(instance, false);
        if (next) {
          next.el = vnode.el;
          updateComponentPreRender(instance, next, optimized);
        } else {
          next = vnode;
        }
        if (bu) {
          invokeArrayFns$1(bu);
        }
        if (vnodeHook = next.props && next.props.onVnodeBeforeUpdate) {
          invokeVNodeHook(vnodeHook, parent, next, vnode);
        }
        toggleRecurse(instance, true);
        const nextTree = renderComponentRoot(instance);
        const prevTree = instance.subTree;
        instance.subTree = nextTree;
        patch(
          prevTree,
          nextTree,
          // parent may have changed if it's in a teleport
          hostParentNode(prevTree.el),
          // anchor may have changed if it's in a fragment
          getNextHostNode(prevTree),
          instance,
          parentSuspense,
          namespace
        );
        next.el = nextTree.el;
        if (originNext === null) {
          updateHOCHostEl(instance, nextTree.el);
        }
        if (u2) {
          queuePostRenderEffect(u2, parentSuspense);
        }
        if (vnodeHook = next.props && next.props.onVnodeUpdated) {
          queuePostRenderEffect(
            () => invokeVNodeHook(vnodeHook, parent, next, vnode),
            parentSuspense
          );
        }
      }
    };
    const effect = instance.effect = new ReactiveEffect(
      componentUpdateFn,
      NOOP,
      () => queueJob(update),
      instance.scope
      // track it in component's effect scope
    );
    const update = instance.update = () => {
      if (effect.dirty) {
        effect.run();
      }
    };
    update.id = instance.uid;
    toggleRecurse(instance, true);
    update();
  };
  const updateComponentPreRender = (instance, nextVNode, optimized) => {
    nextVNode.component = instance;
    const prevProps = instance.vnode.props;
    instance.vnode = nextVNode;
    instance.next = null;
    updateProps(instance, nextVNode.props, prevProps, optimized);
    updateSlots(instance, nextVNode.children, optimized);
    pauseTracking();
    flushPreFlushCbs(instance);
    resetTracking();
  };
  const patchChildren = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized = false) => {
    const c1 = n1 && n1.children;
    const prevShapeFlag = n1 ? n1.shapeFlag : 0;
    const c2 = n2.children;
    const { patchFlag, shapeFlag } = n2;
    if (patchFlag > 0) {
      if (patchFlag & 128) {
        patchKeyedChildren(
          c1,
          c2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        );
        return;
      } else if (patchFlag & 256) {
        patchUnkeyedChildren(
          c1,
          c2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        );
        return;
      }
    }
    if (shapeFlag & 8) {
      if (prevShapeFlag & 16) {
        unmountChildren(c1, parentComponent, parentSuspense);
      }
      if (c2 !== c1) {
        hostSetElementText(container, c2);
      }
    } else {
      if (prevShapeFlag & 16) {
        if (shapeFlag & 16) {
          patchKeyedChildren(
            c1,
            c2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        } else {
          unmountChildren(c1, parentComponent, parentSuspense, true);
        }
      } else {
        if (prevShapeFlag & 8) {
          hostSetElementText(container, "");
        }
        if (shapeFlag & 16) {
          mountChildren(
            c2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        }
      }
    }
  };
  const patchUnkeyedChildren = (c1, c2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
    c1 = c1 || EMPTY_ARR;
    c2 = c2 || EMPTY_ARR;
    const oldLength = c1.length;
    const newLength = c2.length;
    const commonLength = Math.min(oldLength, newLength);
    let i2;
    for (i2 = 0; i2 < commonLength; i2++) {
      const nextChild = c2[i2] = optimized ? cloneIfMounted(c2[i2]) : normalizeVNode(c2[i2]);
      patch(
        c1[i2],
        nextChild,
        container,
        null,
        parentComponent,
        parentSuspense,
        namespace,
        slotScopeIds,
        optimized
      );
    }
    if (oldLength > newLength) {
      unmountChildren(
        c1,
        parentComponent,
        parentSuspense,
        true,
        false,
        commonLength
      );
    } else {
      mountChildren(
        c2,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        namespace,
        slotScopeIds,
        optimized,
        commonLength
      );
    }
  };
  const patchKeyedChildren = (c1, c2, container, parentAnchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
    let i2 = 0;
    const l2 = c2.length;
    let e1 = c1.length - 1;
    let e2 = l2 - 1;
    while (i2 <= e1 && i2 <= e2) {
      const n1 = c1[i2];
      const n2 = c2[i2] = optimized ? cloneIfMounted(c2[i2]) : normalizeVNode(c2[i2]);
      if (isSameVNodeType(n1, n2)) {
        patch(
          n1,
          n2,
          container,
          null,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        );
      } else {
        break;
      }
      i2++;
    }
    while (i2 <= e1 && i2 <= e2) {
      const n1 = c1[e1];
      const n2 = c2[e2] = optimized ? cloneIfMounted(c2[e2]) : normalizeVNode(c2[e2]);
      if (isSameVNodeType(n1, n2)) {
        patch(
          n1,
          n2,
          container,
          null,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        );
      } else {
        break;
      }
      e1--;
      e2--;
    }
    if (i2 > e1) {
      if (i2 <= e2) {
        const nextPos = e2 + 1;
        const anchor = nextPos < l2 ? c2[nextPos].el : parentAnchor;
        while (i2 <= e2) {
          patch(
            null,
            c2[i2] = optimized ? cloneIfMounted(c2[i2]) : normalizeVNode(c2[i2]),
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
          i2++;
        }
      }
    } else if (i2 > e2) {
      while (i2 <= e1) {
        unmount(c1[i2], parentComponent, parentSuspense, true);
        i2++;
      }
    } else {
      const s1 = i2;
      const s2 = i2;
      const keyToNewIndexMap = /* @__PURE__ */ new Map();
      for (i2 = s2; i2 <= e2; i2++) {
        const nextChild = c2[i2] = optimized ? cloneIfMounted(c2[i2]) : normalizeVNode(c2[i2]);
        if (nextChild.key != null) {
          keyToNewIndexMap.set(nextChild.key, i2);
        }
      }
      let j;
      let patched = 0;
      const toBePatched = e2 - s2 + 1;
      let moved = false;
      let maxNewIndexSoFar = 0;
      const newIndexToOldIndexMap = new Array(toBePatched);
      for (i2 = 0; i2 < toBePatched; i2++)
        newIndexToOldIndexMap[i2] = 0;
      for (i2 = s1; i2 <= e1; i2++) {
        const prevChild = c1[i2];
        if (patched >= toBePatched) {
          unmount(prevChild, parentComponent, parentSuspense, true);
          continue;
        }
        let newIndex;
        if (prevChild.key != null) {
          newIndex = keyToNewIndexMap.get(prevChild.key);
        } else {
          for (j = s2; j <= e2; j++) {
            if (newIndexToOldIndexMap[j - s2] === 0 && isSameVNodeType(prevChild, c2[j])) {
              newIndex = j;
              break;
            }
          }
        }
        if (newIndex === void 0) {
          unmount(prevChild, parentComponent, parentSuspense, true);
        } else {
          newIndexToOldIndexMap[newIndex - s2] = i2 + 1;
          if (newIndex >= maxNewIndexSoFar) {
            maxNewIndexSoFar = newIndex;
          } else {
            moved = true;
          }
          patch(
            prevChild,
            c2[newIndex],
            container,
            null,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
          patched++;
        }
      }
      const increasingNewIndexSequence = moved ? getSequence(newIndexToOldIndexMap) : EMPTY_ARR;
      j = increasingNewIndexSequence.length - 1;
      for (i2 = toBePatched - 1; i2 >= 0; i2--) {
        const nextIndex = s2 + i2;
        const nextChild = c2[nextIndex];
        const anchor = nextIndex + 1 < l2 ? c2[nextIndex + 1].el : parentAnchor;
        if (newIndexToOldIndexMap[i2] === 0) {
          patch(
            null,
            nextChild,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        } else if (moved) {
          if (j < 0 || i2 !== increasingNewIndexSequence[j]) {
            move(nextChild, container, anchor, 2);
          } else {
            j--;
          }
        }
      }
    }
  };
  const move = (vnode, container, anchor, moveType, parentSuspense = null) => {
    const { el, type, transition, children, shapeFlag } = vnode;
    if (shapeFlag & 6) {
      move(vnode.component.subTree, container, anchor, moveType);
      return;
    }
    if (shapeFlag & 128) {
      vnode.suspense.move(container, anchor, moveType);
      return;
    }
    if (shapeFlag & 64) {
      type.move(vnode, container, anchor, internals);
      return;
    }
    if (type === Fragment) {
      hostInsert(el, container, anchor);
      for (let i2 = 0; i2 < children.length; i2++) {
        move(children[i2], container, anchor, moveType);
      }
      hostInsert(vnode.anchor, container, anchor);
      return;
    }
    if (type === Static) {
      moveStaticNode(vnode, container, anchor);
      return;
    }
    const needTransition2 = moveType !== 2 && shapeFlag & 1 && transition;
    if (needTransition2) {
      if (moveType === 0) {
        transition.beforeEnter(el);
        hostInsert(el, container, anchor);
        queuePostRenderEffect(() => transition.enter(el), parentSuspense);
      } else {
        const { leave, delayLeave, afterLeave } = transition;
        const remove22 = () => hostInsert(el, container, anchor);
        const performLeave = () => {
          leave(el, () => {
            remove22();
            afterLeave && afterLeave();
          });
        };
        if (delayLeave) {
          delayLeave(el, remove22, performLeave);
        } else {
          performLeave();
        }
      }
    } else {
      hostInsert(el, container, anchor);
    }
  };
  const unmount = (vnode, parentComponent, parentSuspense, doRemove = false, optimized = false) => {
    const {
      type,
      props,
      ref: ref2,
      children,
      dynamicChildren,
      shapeFlag,
      patchFlag,
      dirs
    } = vnode;
    if (ref2 != null) {
      setRef(ref2, null, parentSuspense, vnode, true);
    }
    if (shapeFlag & 256) {
      parentComponent.ctx.deactivate(vnode);
      return;
    }
    const shouldInvokeDirs = shapeFlag & 1 && dirs;
    const shouldInvokeVnodeHook = !isAsyncWrapper(vnode);
    let vnodeHook;
    if (shouldInvokeVnodeHook && (vnodeHook = props && props.onVnodeBeforeUnmount)) {
      invokeVNodeHook(vnodeHook, parentComponent, vnode);
    }
    if (shapeFlag & 6) {
      unmountComponent(vnode.component, parentSuspense, doRemove);
    } else {
      if (shapeFlag & 128) {
        vnode.suspense.unmount(parentSuspense, doRemove);
        return;
      }
      if (shouldInvokeDirs) {
        invokeDirectiveHook(vnode, null, parentComponent, "beforeUnmount");
      }
      if (shapeFlag & 64) {
        vnode.type.remove(
          vnode,
          parentComponent,
          parentSuspense,
          optimized,
          internals,
          doRemove
        );
      } else if (dynamicChildren && // #1153: fast path should not be taken for non-stable (v-for) fragments
      (type !== Fragment || patchFlag > 0 && patchFlag & 64)) {
        unmountChildren(
          dynamicChildren,
          parentComponent,
          parentSuspense,
          false,
          true
        );
      } else if (type === Fragment && patchFlag & (128 | 256) || !optimized && shapeFlag & 16) {
        unmountChildren(children, parentComponent, parentSuspense);
      }
      if (doRemove) {
        remove2(vnode);
      }
    }
    if (shouldInvokeVnodeHook && (vnodeHook = props && props.onVnodeUnmounted) || shouldInvokeDirs) {
      queuePostRenderEffect(() => {
        vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode);
        shouldInvokeDirs && invokeDirectiveHook(vnode, null, parentComponent, "unmounted");
      }, parentSuspense);
    }
  };
  const remove2 = (vnode) => {
    const { type, el, anchor, transition } = vnode;
    if (type === Fragment) {
      {
        removeFragment(el, anchor);
      }
      return;
    }
    if (type === Static) {
      removeStaticNode(vnode);
      return;
    }
    const performRemove = () => {
      hostRemove(el);
      if (transition && !transition.persisted && transition.afterLeave) {
        transition.afterLeave();
      }
    };
    if (vnode.shapeFlag & 1 && transition && !transition.persisted) {
      const { leave, delayLeave } = transition;
      const performLeave = () => leave(el, performRemove);
      if (delayLeave) {
        delayLeave(vnode.el, performRemove, performLeave);
      } else {
        performLeave();
      }
    } else {
      performRemove();
    }
  };
  const removeFragment = (cur, end) => {
    let next;
    while (cur !== end) {
      next = hostNextSibling(cur);
      hostRemove(cur);
      cur = next;
    }
    hostRemove(end);
  };
  const unmountComponent = (instance, parentSuspense, doRemove) => {
    const { bum, scope, update, subTree, um } = instance;
    if (bum) {
      invokeArrayFns$1(bum);
    }
    scope.stop();
    if (update) {
      update.active = false;
      unmount(subTree, instance, parentSuspense, doRemove);
    }
    if (um) {
      queuePostRenderEffect(um, parentSuspense);
    }
    queuePostRenderEffect(() => {
      instance.isUnmounted = true;
    }, parentSuspense);
    if (parentSuspense && parentSuspense.pendingBranch && !parentSuspense.isUnmounted && instance.asyncDep && !instance.asyncResolved && instance.suspenseId === parentSuspense.pendingId) {
      parentSuspense.deps--;
      if (parentSuspense.deps === 0) {
        parentSuspense.resolve();
      }
    }
  };
  const unmountChildren = (children, parentComponent, parentSuspense, doRemove = false, optimized = false, start = 0) => {
    for (let i2 = start; i2 < children.length; i2++) {
      unmount(children[i2], parentComponent, parentSuspense, doRemove, optimized);
    }
  };
  const getNextHostNode = (vnode) => {
    if (vnode.shapeFlag & 6) {
      return getNextHostNode(vnode.component.subTree);
    }
    if (vnode.shapeFlag & 128) {
      return vnode.suspense.next();
    }
    return hostNextSibling(vnode.anchor || vnode.el);
  };
  let isFlushing2 = false;
  const render = (vnode, container, namespace) => {
    if (vnode == null) {
      if (container._vnode) {
        unmount(container._vnode, null, null, true);
      }
    } else {
      patch(
        container._vnode || null,
        vnode,
        container,
        null,
        null,
        null,
        namespace
      );
    }
    if (!isFlushing2) {
      isFlushing2 = true;
      flushPreFlushCbs();
      flushPostFlushCbs();
      isFlushing2 = false;
    }
    container._vnode = vnode;
  };
  const internals = {
    p: patch,
    um: unmount,
    m: move,
    r: remove2,
    mt: mountComponent,
    mc: mountChildren,
    pc: patchChildren,
    pbc: patchBlockChildren,
    n: getNextHostNode,
    o: options
  };
  let hydrate;
  let hydrateNode;
  if (createHydrationFns) {
    [hydrate, hydrateNode] = createHydrationFns(
      internals
    );
  }
  return {
    render,
    hydrate,
    createApp: createAppAPI(render, hydrate)
  };
}
function resolveChildrenNamespace({ type, props }, currentNamespace) {
  return currentNamespace === "svg" && type === "foreignObject" || currentNamespace === "mathml" && type === "annotation-xml" && props && props.encoding && props.encoding.includes("html") ? void 0 : currentNamespace;
}
function toggleRecurse({ effect, update }, allowed) {
  effect.allowRecurse = update.allowRecurse = allowed;
}
function needTransition(parentSuspense, transition) {
  return (!parentSuspense || parentSuspense && !parentSuspense.pendingBranch) && transition && !transition.persisted;
}
function traverseStaticChildren(n1, n2, shallow = false) {
  const ch1 = n1.children;
  const ch2 = n2.children;
  if (isArray$2(ch1) && isArray$2(ch2)) {
    for (let i2 = 0; i2 < ch1.length; i2++) {
      const c1 = ch1[i2];
      let c2 = ch2[i2];
      if (c2.shapeFlag & 1 && !c2.dynamicChildren) {
        if (c2.patchFlag <= 0 || c2.patchFlag === 32) {
          c2 = ch2[i2] = cloneIfMounted(ch2[i2]);
          c2.el = c1.el;
        }
        if (!shallow)
          traverseStaticChildren(c1, c2);
      }
      if (c2.type === Text) {
        c2.el = c1.el;
      }
    }
  }
}
function getSequence(arr) {
  const p2 = arr.slice();
  const result = [0];
  let i2, j, u2, v, c;
  const len = arr.length;
  for (i2 = 0; i2 < len; i2++) {
    const arrI = arr[i2];
    if (arrI !== 0) {
      j = result[result.length - 1];
      if (arr[j] < arrI) {
        p2[i2] = j;
        result.push(i2);
        continue;
      }
      u2 = 0;
      v = result.length - 1;
      while (u2 < v) {
        c = u2 + v >> 1;
        if (arr[result[c]] < arrI) {
          u2 = c + 1;
        } else {
          v = c;
        }
      }
      if (arrI < arr[result[u2]]) {
        if (u2 > 0) {
          p2[i2] = result[u2 - 1];
        }
        result[u2] = i2;
      }
    }
  }
  u2 = result.length;
  v = result[u2 - 1];
  while (u2-- > 0) {
    result[u2] = v;
    v = p2[v];
  }
  return result;
}
function locateNonHydratedAsyncRoot(instance) {
  const subComponent = instance.subTree.component;
  if (subComponent) {
    if (subComponent.asyncDep && !subComponent.asyncResolved) {
      return subComponent;
    } else {
      return locateNonHydratedAsyncRoot(subComponent);
    }
  }
}
const isTeleport = (type) => type.__isTeleport;
const Fragment = Symbol.for("v-fgt");
const Text = Symbol.for("v-txt");
const Comment = Symbol.for("v-cmt");
const Static = Symbol.for("v-stc");
const blockStack = [];
let currentBlock = null;
function openBlock(disableTracking = false) {
  blockStack.push(currentBlock = disableTracking ? null : []);
}
function closeBlock() {
  blockStack.pop();
  currentBlock = blockStack[blockStack.length - 1] || null;
}
let isBlockTreeEnabled = 1;
function setBlockTracking(value) {
  isBlockTreeEnabled += value;
}
function setupBlock(vnode) {
  vnode.dynamicChildren = isBlockTreeEnabled > 0 ? currentBlock || EMPTY_ARR : null;
  closeBlock();
  if (isBlockTreeEnabled > 0 && currentBlock) {
    currentBlock.push(vnode);
  }
  return vnode;
}
function createElementBlock(type, props, children, patchFlag, dynamicProps, shapeFlag) {
  return setupBlock(
    createBaseVNode(
      type,
      props,
      children,
      patchFlag,
      dynamicProps,
      shapeFlag,
      true
    )
  );
}
function createBlock(type, props, children, patchFlag, dynamicProps) {
  return setupBlock(
    createVNode(
      type,
      props,
      children,
      patchFlag,
      dynamicProps,
      true
    )
  );
}
function isVNode(value) {
  return value ? value.__v_isVNode === true : false;
}
function isSameVNodeType(n1, n2) {
  return n1.type === n2.type && n1.key === n2.key;
}
const InternalObjectKey = `__vInternal`;
const normalizeKey = ({ key }) => key != null ? key : null;
const normalizeRef = ({
  ref: ref2,
  ref_key,
  ref_for
}) => {
  if (typeof ref2 === "number") {
    ref2 = "" + ref2;
  }
  return ref2 != null ? isString$1(ref2) || isRef(ref2) || isFunction$1(ref2) ? { i: currentRenderingInstance, r: ref2, k: ref_key, f: !!ref_for } : ref2 : null;
};
function createBaseVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, shapeFlag = type === Fragment ? 0 : 1, isBlockNode = false, needFullChildrenNormalization = false) {
  const vnode = {
    __v_isVNode: true,
    __v_skip: true,
    type,
    props,
    key: props && normalizeKey(props),
    ref: props && normalizeRef(props),
    scopeId: currentScopeId,
    slotScopeIds: null,
    children,
    component: null,
    suspense: null,
    ssContent: null,
    ssFallback: null,
    dirs: null,
    transition: null,
    el: null,
    anchor: null,
    target: null,
    targetAnchor: null,
    staticCount: 0,
    shapeFlag,
    patchFlag,
    dynamicProps,
    dynamicChildren: null,
    appContext: null,
    ctx: currentRenderingInstance
  };
  if (needFullChildrenNormalization) {
    normalizeChildren(vnode, children);
    if (shapeFlag & 128) {
      type.normalize(vnode);
    }
  } else if (children) {
    vnode.shapeFlag |= isString$1(children) ? 8 : 16;
  }
  if (isBlockTreeEnabled > 0 && // avoid a block node from tracking itself
  !isBlockNode && // has current parent block
  currentBlock && // presence of a patch flag indicates this node needs patching on updates.
  // component nodes also should always be patched, because even if the
  // component doesn't need to update, it needs to persist the instance on to
  // the next vnode so that it can be properly unmounted later.
  (vnode.patchFlag > 0 || shapeFlag & 6) && // the EVENTS flag is only for hydration and if it is the only flag, the
  // vnode should not be considered dynamic due to handler caching.
  vnode.patchFlag !== 32) {
    currentBlock.push(vnode);
  }
  return vnode;
}
const createVNode = _createVNode;
function _createVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, isBlockNode = false) {
  if (!type || type === NULL_DYNAMIC_COMPONENT) {
    type = Comment;
  }
  if (isVNode(type)) {
    const cloned = cloneVNode(
      type,
      props,
      true
      /* mergeRef: true */
    );
    if (children) {
      normalizeChildren(cloned, children);
    }
    if (isBlockTreeEnabled > 0 && !isBlockNode && currentBlock) {
      if (cloned.shapeFlag & 6) {
        currentBlock[currentBlock.indexOf(type)] = cloned;
      } else {
        currentBlock.push(cloned);
      }
    }
    cloned.patchFlag |= -2;
    return cloned;
  }
  if (isClassComponent(type)) {
    type = type.__vccOpts;
  }
  if (props) {
    props = guardReactiveProps(props);
    let { class: klass, style } = props;
    if (klass && !isString$1(klass)) {
      props.class = normalizeClass(klass);
    }
    if (isObject$1(style)) {
      if (isProxy(style) && !isArray$2(style)) {
        style = extend$1({}, style);
      }
      props.style = normalizeStyle(style);
    }
  }
  const shapeFlag = isString$1(type) ? 1 : isSuspense(type) ? 128 : isTeleport(type) ? 64 : isObject$1(type) ? 4 : isFunction$1(type) ? 2 : 0;
  return createBaseVNode(
    type,
    props,
    children,
    patchFlag,
    dynamicProps,
    shapeFlag,
    isBlockNode,
    true
  );
}
function guardReactiveProps(props) {
  if (!props)
    return null;
  return isProxy(props) || InternalObjectKey in props ? extend$1({}, props) : props;
}
function cloneVNode(vnode, extraProps, mergeRef = false) {
  const { props, ref: ref2, patchFlag, children } = vnode;
  const mergedProps = extraProps ? mergeProps(props || {}, extraProps) : props;
  const cloned = {
    __v_isVNode: true,
    __v_skip: true,
    type: vnode.type,
    props: mergedProps,
    key: mergedProps && normalizeKey(mergedProps),
    ref: extraProps && extraProps.ref ? (
      // #2078 in the case of <component :is="vnode" ref="extra"/>
      // if the vnode itself already has a ref, cloneVNode will need to merge
      // the refs so the single vnode can be set on multiple refs
      mergeRef && ref2 ? isArray$2(ref2) ? ref2.concat(normalizeRef(extraProps)) : [ref2, normalizeRef(extraProps)] : normalizeRef(extraProps)
    ) : ref2,
    scopeId: vnode.scopeId,
    slotScopeIds: vnode.slotScopeIds,
    children,
    target: vnode.target,
    targetAnchor: vnode.targetAnchor,
    staticCount: vnode.staticCount,
    shapeFlag: vnode.shapeFlag,
    // if the vnode is cloned with extra props, we can no longer assume its
    // existing patch flag to be reliable and need to add the FULL_PROPS flag.
    // note: preserve flag for fragments since they use the flag for children
    // fast paths only.
    patchFlag: extraProps && vnode.type !== Fragment ? patchFlag === -1 ? 16 : patchFlag | 16 : patchFlag,
    dynamicProps: vnode.dynamicProps,
    dynamicChildren: vnode.dynamicChildren,
    appContext: vnode.appContext,
    dirs: vnode.dirs,
    transition: vnode.transition,
    // These should technically only be non-null on mounted VNodes. However,
    // they *should* be copied for kept-alive vnodes. So we just always copy
    // them since them being non-null during a mount doesn't affect the logic as
    // they will simply be overwritten.
    component: vnode.component,
    suspense: vnode.suspense,
    ssContent: vnode.ssContent && cloneVNode(vnode.ssContent),
    ssFallback: vnode.ssFallback && cloneVNode(vnode.ssFallback),
    el: vnode.el,
    anchor: vnode.anchor,
    ctx: vnode.ctx,
    ce: vnode.ce
  };
  return cloned;
}
function createTextVNode(text = " ", flag = 0) {
  return createVNode(Text, null, text, flag);
}
function createStaticVNode(content, numberOfNodes) {
  const vnode = createVNode(Static, null, content);
  vnode.staticCount = numberOfNodes;
  return vnode;
}
function createCommentVNode(text = "", asBlock = false) {
  return asBlock ? (openBlock(), createBlock(Comment, null, text)) : createVNode(Comment, null, text);
}
function normalizeVNode(child) {
  if (child == null || typeof child === "boolean") {
    return createVNode(Comment);
  } else if (isArray$2(child)) {
    return createVNode(
      Fragment,
      null,
      // #3666, avoid reference pollution when reusing vnode
      child.slice()
    );
  } else if (typeof child === "object") {
    return cloneIfMounted(child);
  } else {
    return createVNode(Text, null, String(child));
  }
}
function cloneIfMounted(child) {
  return child.el === null && child.patchFlag !== -1 || child.memo ? child : cloneVNode(child);
}
function normalizeChildren(vnode, children) {
  let type = 0;
  const { shapeFlag } = vnode;
  if (children == null) {
    children = null;
  } else if (isArray$2(children)) {
    type = 16;
  } else if (typeof children === "object") {
    if (shapeFlag & (1 | 64)) {
      const slot = children.default;
      if (slot) {
        slot._c && (slot._d = false);
        normalizeChildren(vnode, slot());
        slot._c && (slot._d = true);
      }
      return;
    } else {
      type = 32;
      const slotFlag = children._;
      if (!slotFlag && !(InternalObjectKey in children)) {
        children._ctx = currentRenderingInstance;
      } else if (slotFlag === 3 && currentRenderingInstance) {
        if (currentRenderingInstance.slots._ === 1) {
          children._ = 1;
        } else {
          children._ = 2;
          vnode.patchFlag |= 1024;
        }
      }
    }
  } else if (isFunction$1(children)) {
    children = { default: children, _ctx: currentRenderingInstance };
    type = 32;
  } else {
    children = String(children);
    if (shapeFlag & 64) {
      type = 16;
      children = [createTextVNode(children)];
    } else {
      type = 8;
    }
  }
  vnode.children = children;
  vnode.shapeFlag |= type;
}
function mergeProps(...args) {
  const ret = {};
  for (let i2 = 0; i2 < args.length; i2++) {
    const toMerge = args[i2];
    for (const key in toMerge) {
      if (key === "class") {
        if (ret.class !== toMerge.class) {
          ret.class = normalizeClass([ret.class, toMerge.class]);
        }
      } else if (key === "style") {
        ret.style = normalizeStyle([ret.style, toMerge.style]);
      } else if (isOn$1(key)) {
        const existing = ret[key];
        const incoming = toMerge[key];
        if (incoming && existing !== incoming && !(isArray$2(existing) && existing.includes(incoming))) {
          ret[key] = existing ? [].concat(existing, incoming) : incoming;
        }
      } else if (key !== "") {
        ret[key] = toMerge[key];
      }
    }
  }
  return ret;
}
function invokeVNodeHook(hook, instance, vnode, prevVNode = null) {
  callWithAsyncErrorHandling(hook, instance, 7, [
    vnode,
    prevVNode
  ]);
}
const emptyAppContext = createAppContext();
let uid = 0;
function createComponentInstance(vnode, parent, suspense) {
  const type = vnode.type;
  const appContext = (parent ? parent.appContext : vnode.appContext) || emptyAppContext;
  const instance = {
    uid: uid++,
    vnode,
    type,
    parent,
    appContext,
    root: null,
    // to be immediately set
    next: null,
    subTree: null,
    // will be set synchronously right after creation
    effect: null,
    update: null,
    // will be set synchronously right after creation
    scope: new EffectScope(
      true
      /* detached */
    ),
    render: null,
    proxy: null,
    exposed: null,
    exposeProxy: null,
    withProxy: null,
    provides: parent ? parent.provides : Object.create(appContext.provides),
    accessCache: null,
    renderCache: [],
    // local resolved assets
    components: null,
    directives: null,
    // resolved props and emits options
    propsOptions: normalizePropsOptions(type, appContext),
    emitsOptions: normalizeEmitsOptions(type, appContext),
    // emit
    emit: null,
    // to be set immediately
    emitted: null,
    // props default value
    propsDefaults: EMPTY_OBJ,
    // inheritAttrs
    inheritAttrs: type.inheritAttrs,
    // state
    ctx: EMPTY_OBJ,
    data: EMPTY_OBJ,
    props: EMPTY_OBJ,
    attrs: EMPTY_OBJ,
    slots: EMPTY_OBJ,
    refs: EMPTY_OBJ,
    setupState: EMPTY_OBJ,
    setupContext: null,
    attrsProxy: null,
    slotsProxy: null,
    // suspense related
    suspense,
    suspenseId: suspense ? suspense.pendingId : 0,
    asyncDep: null,
    asyncResolved: false,
    // lifecycle hooks
    // not using enums here because it results in computed properties
    isMounted: false,
    isUnmounted: false,
    isDeactivated: false,
    bc: null,
    c: null,
    bm: null,
    m: null,
    bu: null,
    u: null,
    um: null,
    bum: null,
    da: null,
    a: null,
    rtg: null,
    rtc: null,
    ec: null,
    sp: null
  };
  {
    instance.ctx = { _: instance };
  }
  instance.root = parent ? parent.root : instance;
  instance.emit = emit.bind(null, instance);
  if (vnode.ce) {
    vnode.ce(instance);
  }
  return instance;
}
let currentInstance = null;
let internalSetCurrentInstance;
let setInSSRSetupState;
{
  const g = getGlobalThis();
  const registerGlobalSetter = (key, setter) => {
    let setters;
    if (!(setters = g[key]))
      setters = g[key] = [];
    setters.push(setter);
    return (v) => {
      if (setters.length > 1)
        setters.forEach((set2) => set2(v));
      else
        setters[0](v);
    };
  };
  internalSetCurrentInstance = registerGlobalSetter(
    `__VUE_INSTANCE_SETTERS__`,
    (v) => currentInstance = v
  );
  setInSSRSetupState = registerGlobalSetter(
    `__VUE_SSR_SETTERS__`,
    (v) => isInSSRComponentSetup = v
  );
}
const setCurrentInstance = (instance) => {
  const prev = currentInstance;
  internalSetCurrentInstance(instance);
  instance.scope.on();
  return () => {
    instance.scope.off();
    internalSetCurrentInstance(prev);
  };
};
const unsetCurrentInstance = () => {
  currentInstance && currentInstance.scope.off();
  internalSetCurrentInstance(null);
};
function isStatefulComponent(instance) {
  return instance.vnode.shapeFlag & 4;
}
let isInSSRComponentSetup = false;
function setupComponent(instance, isSSR = false) {
  isSSR && setInSSRSetupState(isSSR);
  const { props, children } = instance.vnode;
  const isStateful = isStatefulComponent(instance);
  initProps(instance, props, isStateful, isSSR);
  initSlots(instance, children);
  const setupResult = isStateful ? setupStatefulComponent(instance, isSSR) : void 0;
  isSSR && setInSSRSetupState(false);
  return setupResult;
}
function setupStatefulComponent(instance, isSSR) {
  const Component = instance.type;
  instance.accessCache = /* @__PURE__ */ Object.create(null);
  instance.proxy = markRaw(new Proxy(instance.ctx, PublicInstanceProxyHandlers));
  const { setup } = Component;
  if (setup) {
    const setupContext = instance.setupContext = setup.length > 1 ? createSetupContext(instance) : null;
    const reset = setCurrentInstance(instance);
    pauseTracking();
    const setupResult = callWithErrorHandling(
      setup,
      instance,
      0,
      [
        instance.props,
        setupContext
      ]
    );
    resetTracking();
    reset();
    if (isPromise(setupResult)) {
      setupResult.then(unsetCurrentInstance, unsetCurrentInstance);
      if (isSSR) {
        return setupResult.then((resolvedResult) => {
          handleSetupResult(instance, resolvedResult, isSSR);
        }).catch((e) => {
          handleError(e, instance, 0);
        });
      } else {
        instance.asyncDep = setupResult;
      }
    } else {
      handleSetupResult(instance, setupResult, isSSR);
    }
  } else {
    finishComponentSetup(instance, isSSR);
  }
}
function handleSetupResult(instance, setupResult, isSSR) {
  if (isFunction$1(setupResult)) {
    if (instance.type.__ssrInlineRender) {
      instance.ssrRender = setupResult;
    } else {
      instance.render = setupResult;
    }
  } else if (isObject$1(setupResult)) {
    instance.setupState = proxyRefs(setupResult);
  } else
    ;
  finishComponentSetup(instance, isSSR);
}
let compile;
function finishComponentSetup(instance, isSSR, skipOptions) {
  const Component = instance.type;
  if (!instance.render) {
    if (!isSSR && compile && !Component.render) {
      const template = Component.template || resolveMergedOptions(instance).template;
      if (template) {
        const { isCustomElement, compilerOptions } = instance.appContext.config;
        const { delimiters, compilerOptions: componentCompilerOptions } = Component;
        const finalCompilerOptions = extend$1(
          extend$1(
            {
              isCustomElement,
              delimiters
            },
            compilerOptions
          ),
          componentCompilerOptions
        );
        Component.render = compile(template, finalCompilerOptions);
      }
    }
    instance.render = Component.render || NOOP;
  }
  {
    const reset = setCurrentInstance(instance);
    pauseTracking();
    try {
      applyOptions(instance);
    } finally {
      resetTracking();
      reset();
    }
  }
}
function getAttrsProxy(instance) {
  return instance.attrsProxy || (instance.attrsProxy = new Proxy(
    instance.attrs,
    {
      get(target, key) {
        track(instance, "get", "$attrs");
        return target[key];
      }
    }
  ));
}
function createSetupContext(instance) {
  const expose = (exposed) => {
    instance.exposed = exposed || {};
  };
  {
    return {
      get attrs() {
        return getAttrsProxy(instance);
      },
      slots: instance.slots,
      emit: instance.emit,
      expose
    };
  }
}
function getExposeProxy(instance) {
  if (instance.exposed) {
    return instance.exposeProxy || (instance.exposeProxy = new Proxy(proxyRefs(markRaw(instance.exposed)), {
      get(target, key) {
        if (key in target) {
          return target[key];
        } else if (key in publicPropertiesMap) {
          return publicPropertiesMap[key](instance);
        }
      },
      has(target, key) {
        return key in target || key in publicPropertiesMap;
      }
    }));
  }
}
const classifyRE = /(?:^|[-_])(\w)/g;
const classify = (str) => str.replace(classifyRE, (c) => c.toUpperCase()).replace(/[-_]/g, "");
function getComponentName(Component, includeInferred = true) {
  return isFunction$1(Component) ? Component.displayName || Component.name : Component.name || includeInferred && Component.__name;
}
function formatComponentName(instance, Component, isRoot = false) {
  let name = getComponentName(Component);
  if (!name && Component.__file) {
    const match = Component.__file.match(/([^/\\]+)\.\w+$/);
    if (match) {
      name = match[1];
    }
  }
  if (!name && instance && instance.parent) {
    const inferFromRegistry = (registry) => {
      for (const key in registry) {
        if (registry[key] === Component) {
          return key;
        }
      }
    };
    name = inferFromRegistry(
      instance.components || instance.parent.type.components
    ) || inferFromRegistry(instance.appContext.components);
  }
  return name ? classify(name) : isRoot ? `App` : `Anonymous`;
}
function isClassComponent(value) {
  return isFunction$1(value) && "__vccOpts" in value;
}
const computed = (getterOrOptions, debugOptions) => {
  return computed$1(getterOrOptions, debugOptions, isInSSRComponentSetup);
};
function h(type, propsOrChildren, children) {
  const l = arguments.length;
  if (l === 2) {
    if (isObject$1(propsOrChildren) && !isArray$2(propsOrChildren)) {
      if (isVNode(propsOrChildren)) {
        return createVNode(type, null, [propsOrChildren]);
      }
      return createVNode(type, propsOrChildren);
    } else {
      return createVNode(type, null, propsOrChildren);
    }
  } else {
    if (l > 3) {
      children = Array.prototype.slice.call(arguments, 2);
    } else if (l === 3 && isVNode(children)) {
      children = [children];
    }
    return createVNode(type, propsOrChildren, children);
  }
}
const version = "3.4.19";
/**
* @vue/shared v3.4.19
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
function makeMap(str, expectsLowerCase) {
  const set2 = new Set(str.split(","));
  return expectsLowerCase ? (val) => set2.has(val.toLowerCase()) : (val) => set2.has(val);
}
const isOn = (key) => key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && // uppercase letter
(key.charCodeAt(2) > 122 || key.charCodeAt(2) < 97);
const isModelListener = (key) => key.startsWith("onUpdate:");
const extend = Object.assign;
const isArray$1 = Array.isArray;
const isSet = (val) => toTypeString(val) === "[object Set]";
const isDate = (val) => toTypeString(val) === "[object Date]";
const isFunction = (val) => typeof val === "function";
const isString = (val) => typeof val === "string";
const isSymbol = (val) => typeof val === "symbol";
const isObject = (val) => val !== null && typeof val === "object";
const objectToString = Object.prototype.toString;
const toTypeString = (value) => objectToString.call(value);
const cacheStringFunction = (fn) => {
  const cache = /* @__PURE__ */ Object.create(null);
  return (str) => {
    const hit = cache[str];
    return hit || (cache[str] = fn(str));
  };
};
const hyphenateRE = /\B([A-Z])/g;
const hyphenate = cacheStringFunction(
  (str) => str.replace(hyphenateRE, "-$1").toLowerCase()
);
const capitalize = cacheStringFunction((str) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
});
const invokeArrayFns = (fns, arg) => {
  for (let i2 = 0; i2 < fns.length; i2++) {
    fns[i2](arg);
  }
};
const looseToNumber = (val) => {
  const n = parseFloat(val);
  return isNaN(n) ? val : n;
};
const specialBooleanAttrs = `itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly`;
const isSpecialBooleanAttr = /* @__PURE__ */ makeMap(specialBooleanAttrs);
function includeBooleanAttr(value) {
  return !!value || value === "";
}
function looseCompareArrays(a, b) {
  if (a.length !== b.length)
    return false;
  let equal = true;
  for (let i2 = 0; equal && i2 < a.length; i2++) {
    equal = looseEqual(a[i2], b[i2]);
  }
  return equal;
}
function looseEqual(a, b) {
  if (a === b)
    return true;
  let aValidType = isDate(a);
  let bValidType = isDate(b);
  if (aValidType || bValidType) {
    return aValidType && bValidType ? a.getTime() === b.getTime() : false;
  }
  aValidType = isSymbol(a);
  bValidType = isSymbol(b);
  if (aValidType || bValidType) {
    return a === b;
  }
  aValidType = isArray$1(a);
  bValidType = isArray$1(b);
  if (aValidType || bValidType) {
    return aValidType && bValidType ? looseCompareArrays(a, b) : false;
  }
  aValidType = isObject(a);
  bValidType = isObject(b);
  if (aValidType || bValidType) {
    if (!aValidType || !bValidType) {
      return false;
    }
    const aKeysCount = Object.keys(a).length;
    const bKeysCount = Object.keys(b).length;
    if (aKeysCount !== bKeysCount) {
      return false;
    }
    for (const key in a) {
      const aHasKey = a.hasOwnProperty(key);
      const bHasKey = b.hasOwnProperty(key);
      if (aHasKey && !bHasKey || !aHasKey && bHasKey || !looseEqual(a[key], b[key])) {
        return false;
      }
    }
  }
  return String(a) === String(b);
}
function looseIndexOf(arr, val) {
  return arr.findIndex((item) => looseEqual(item, val));
}
/**
* @vue/runtime-dom v3.4.19
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
const svgNS = "http://www.w3.org/2000/svg";
const mathmlNS = "http://www.w3.org/1998/Math/MathML";
const doc = typeof document !== "undefined" ? document : null;
const templateContainer = doc && /* @__PURE__ */ doc.createElement("template");
const nodeOps = {
  insert: (child, parent, anchor) => {
    parent.insertBefore(child, anchor || null);
  },
  remove: (child) => {
    const parent = child.parentNode;
    if (parent) {
      parent.removeChild(child);
    }
  },
  createElement: (tag, namespace, is, props) => {
    const el = namespace === "svg" ? doc.createElementNS(svgNS, tag) : namespace === "mathml" ? doc.createElementNS(mathmlNS, tag) : doc.createElement(tag, is ? { is } : void 0);
    if (tag === "select" && props && props.multiple != null) {
      el.setAttribute("multiple", props.multiple);
    }
    return el;
  },
  createText: (text) => doc.createTextNode(text),
  createComment: (text) => doc.createComment(text),
  setText: (node, text) => {
    node.nodeValue = text;
  },
  setElementText: (el, text) => {
    el.textContent = text;
  },
  parentNode: (node) => node.parentNode,
  nextSibling: (node) => node.nextSibling,
  querySelector: (selector) => doc.querySelector(selector),
  setScopeId(el, id) {
    el.setAttribute(id, "");
  },
  // __UNSAFE__
  // Reason: innerHTML.
  // Static content here can only come from compiled templates.
  // As long as the user only uses trusted templates, this is safe.
  insertStaticContent(content, parent, anchor, namespace, start, end) {
    const before = anchor ? anchor.previousSibling : parent.lastChild;
    if (start && (start === end || start.nextSibling)) {
      while (true) {
        parent.insertBefore(start.cloneNode(true), anchor);
        if (start === end || !(start = start.nextSibling))
          break;
      }
    } else {
      templateContainer.innerHTML = namespace === "svg" ? `<svg>${content}</svg>` : namespace === "mathml" ? `<math>${content}</math>` : content;
      const template = templateContainer.content;
      if (namespace === "svg" || namespace === "mathml") {
        const wrapper = template.firstChild;
        while (wrapper.firstChild) {
          template.appendChild(wrapper.firstChild);
        }
        template.removeChild(wrapper);
      }
      parent.insertBefore(template, anchor);
    }
    return [
      // first
      before ? before.nextSibling : parent.firstChild,
      // last
      anchor ? anchor.previousSibling : parent.lastChild
    ];
  }
};
const vtcKey = Symbol("_vtc");
function patchClass(el, value, isSVG) {
  const transitionClasses = el[vtcKey];
  if (transitionClasses) {
    value = (value ? [value, ...transitionClasses] : [...transitionClasses]).join(" ");
  }
  if (value == null) {
    el.removeAttribute("class");
  } else if (isSVG) {
    el.setAttribute("class", value);
  } else {
    el.className = value;
  }
}
const vShowOldKey = Symbol("_vod");
const CSS_VAR_TEXT = Symbol("");
const displayRE = /(^|;)\s*display\s*:/;
function patchStyle(el, prev, next) {
  const style = el.style;
  const isCssString = isString(next);
  const currentDisplay = style.display;
  let hasControlledDisplay = false;
  if (next && !isCssString) {
    if (prev && !isString(prev)) {
      for (const key in prev) {
        if (next[key] == null) {
          setStyle(style, key, "");
        }
      }
    }
    for (const key in next) {
      if (key === "display") {
        hasControlledDisplay = true;
      }
      setStyle(style, key, next[key]);
    }
  } else {
    if (isCssString) {
      if (prev !== next) {
        const cssVarText = style[CSS_VAR_TEXT];
        if (cssVarText) {
          next += ";" + cssVarText;
        }
        style.cssText = next;
        hasControlledDisplay = displayRE.test(next);
      }
    } else if (prev) {
      el.removeAttribute("style");
    }
  }
  if (vShowOldKey in el) {
    el[vShowOldKey] = hasControlledDisplay ? style.display : "";
    style.display = currentDisplay;
  }
}
const importantRE = /\s*!important$/;
function setStyle(style, name, val) {
  if (isArray$1(val)) {
    val.forEach((v) => setStyle(style, name, v));
  } else {
    if (val == null)
      val = "";
    if (name.startsWith("--")) {
      style.setProperty(name, val);
    } else {
      const prefixed = autoPrefix(style, name);
      if (importantRE.test(val)) {
        style.setProperty(
          hyphenate(prefixed),
          val.replace(importantRE, ""),
          "important"
        );
      } else {
        style[prefixed] = val;
      }
    }
  }
}
const prefixes = ["Webkit", "Moz", "ms"];
const prefixCache = {};
function autoPrefix(style, rawName) {
  const cached = prefixCache[rawName];
  if (cached) {
    return cached;
  }
  let name = camelize(rawName);
  if (name !== "filter" && name in style) {
    return prefixCache[rawName] = name;
  }
  name = capitalize(name);
  for (let i2 = 0; i2 < prefixes.length; i2++) {
    const prefixed = prefixes[i2] + name;
    if (prefixed in style) {
      return prefixCache[rawName] = prefixed;
    }
  }
  return rawName;
}
const xlinkNS = "http://www.w3.org/1999/xlink";
function patchAttr(el, key, value, isSVG, instance) {
  if (isSVG && key.startsWith("xlink:")) {
    if (value == null) {
      el.removeAttributeNS(xlinkNS, key.slice(6, key.length));
    } else {
      el.setAttributeNS(xlinkNS, key, value);
    }
  } else {
    const isBoolean = isSpecialBooleanAttr(key);
    if (value == null || isBoolean && !includeBooleanAttr(value)) {
      el.removeAttribute(key);
    } else {
      el.setAttribute(key, isBoolean ? "" : value);
    }
  }
}
function patchDOMProp(el, key, value, prevChildren, parentComponent, parentSuspense, unmountChildren) {
  if (key === "innerHTML" || key === "textContent") {
    if (prevChildren) {
      unmountChildren(prevChildren, parentComponent, parentSuspense);
    }
    el[key] = value == null ? "" : value;
    return;
  }
  const tag = el.tagName;
  if (key === "value" && tag !== "PROGRESS" && // custom elements may use _value internally
  !tag.includes("-")) {
    el._value = value;
    const oldValue = tag === "OPTION" ? el.getAttribute("value") : el.value;
    const newValue = value == null ? "" : value;
    if (oldValue !== newValue) {
      el.value = newValue;
    }
    if (value == null) {
      el.removeAttribute(key);
    }
    return;
  }
  let needRemove = false;
  if (value === "" || value == null) {
    const type = typeof el[key];
    if (type === "boolean") {
      value = includeBooleanAttr(value);
    } else if (value == null && type === "string") {
      value = "";
      needRemove = true;
    } else if (type === "number") {
      value = 0;
      needRemove = true;
    }
  }
  try {
    el[key] = value;
  } catch (e) {
  }
  needRemove && el.removeAttribute(key);
}
function addEventListener(el, event, handler, options) {
  el.addEventListener(event, handler, options);
}
function removeEventListener(el, event, handler, options) {
  el.removeEventListener(event, handler, options);
}
const veiKey = Symbol("_vei");
function patchEvent(el, rawName, prevValue, nextValue, instance = null) {
  const invokers = el[veiKey] || (el[veiKey] = {});
  const existingInvoker = invokers[rawName];
  if (nextValue && existingInvoker) {
    existingInvoker.value = nextValue;
  } else {
    const [name, options] = parseName(rawName);
    if (nextValue) {
      const invoker = invokers[rawName] = createInvoker(nextValue, instance);
      addEventListener(el, name, invoker, options);
    } else if (existingInvoker) {
      removeEventListener(el, name, existingInvoker, options);
      invokers[rawName] = void 0;
    }
  }
}
const optionsModifierRE = /(?:Once|Passive|Capture)$/;
function parseName(name) {
  let options;
  if (optionsModifierRE.test(name)) {
    options = {};
    let m;
    while (m = name.match(optionsModifierRE)) {
      name = name.slice(0, name.length - m[0].length);
      options[m[0].toLowerCase()] = true;
    }
  }
  const event = name[2] === ":" ? name.slice(3) : hyphenate(name.slice(2));
  return [event, options];
}
let cachedNow = 0;
const p = /* @__PURE__ */ Promise.resolve();
const getNow = () => cachedNow || (p.then(() => cachedNow = 0), cachedNow = Date.now());
function createInvoker(initialValue, instance) {
  const invoker = (e) => {
    if (!e._vts) {
      e._vts = Date.now();
    } else if (e._vts <= invoker.attached) {
      return;
    }
    callWithAsyncErrorHandling(
      patchStopImmediatePropagation(e, invoker.value),
      instance,
      5,
      [e]
    );
  };
  invoker.value = initialValue;
  invoker.attached = getNow();
  return invoker;
}
function patchStopImmediatePropagation(e, value) {
  if (isArray$1(value)) {
    const originalStop = e.stopImmediatePropagation;
    e.stopImmediatePropagation = () => {
      originalStop.call(e);
      e._stopped = true;
    };
    return value.map((fn) => (e2) => !e2._stopped && fn && fn(e2));
  } else {
    return value;
  }
}
const isNativeOn = (key) => key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && // lowercase letter
key.charCodeAt(2) > 96 && key.charCodeAt(2) < 123;
const patchProp = (el, key, prevValue, nextValue, namespace, prevChildren, parentComponent, parentSuspense, unmountChildren) => {
  const isSVG = namespace === "svg";
  if (key === "class") {
    patchClass(el, nextValue, isSVG);
  } else if (key === "style") {
    patchStyle(el, prevValue, nextValue);
  } else if (isOn(key)) {
    if (!isModelListener(key)) {
      patchEvent(el, key, prevValue, nextValue, parentComponent);
    }
  } else if (key[0] === "." ? (key = key.slice(1), true) : key[0] === "^" ? (key = key.slice(1), false) : shouldSetAsProp(el, key, nextValue, isSVG)) {
    patchDOMProp(
      el,
      key,
      nextValue,
      prevChildren,
      parentComponent,
      parentSuspense,
      unmountChildren
    );
  } else {
    if (key === "true-value") {
      el._trueValue = nextValue;
    } else if (key === "false-value") {
      el._falseValue = nextValue;
    }
    patchAttr(el, key, nextValue, isSVG);
  }
};
function shouldSetAsProp(el, key, value, isSVG) {
  if (isSVG) {
    if (key === "innerHTML" || key === "textContent") {
      return true;
    }
    if (key in el && isNativeOn(key) && isFunction(value)) {
      return true;
    }
    return false;
  }
  if (key === "spellcheck" || key === "draggable" || key === "translate") {
    return false;
  }
  if (key === "form") {
    return false;
  }
  if (key === "list" && el.tagName === "INPUT") {
    return false;
  }
  if (key === "type" && el.tagName === "TEXTAREA") {
    return false;
  }
  if (key === "width" || key === "height") {
    const tag = el.tagName;
    if (tag === "IMG" || tag === "VIDEO" || tag === "CANVAS" || tag === "SOURCE") {
      return false;
    }
  }
  if (isNativeOn(key) && isString(value)) {
    return false;
  }
  return key in el;
}
const getModelAssigner = (vnode) => {
  const fn = vnode.props["onUpdate:modelValue"] || false;
  return isArray$1(fn) ? (value) => invokeArrayFns(fn, value) : fn;
};
function onCompositionStart(e) {
  e.target.composing = true;
}
function onCompositionEnd(e) {
  const target = e.target;
  if (target.composing) {
    target.composing = false;
    target.dispatchEvent(new Event("input"));
  }
}
const assignKey = Symbol("_assign");
const vModelText = {
  created(el, { modifiers: { lazy, trim, number: number2 } }, vnode) {
    el[assignKey] = getModelAssigner(vnode);
    const castToNumber = number2 || vnode.props && vnode.props.type === "number";
    addEventListener(el, lazy ? "change" : "input", (e) => {
      if (e.target.composing)
        return;
      let domValue = el.value;
      if (trim) {
        domValue = domValue.trim();
      }
      if (castToNumber) {
        domValue = looseToNumber(domValue);
      }
      el[assignKey](domValue);
    });
    if (trim) {
      addEventListener(el, "change", () => {
        el.value = el.value.trim();
      });
    }
    if (!lazy) {
      addEventListener(el, "compositionstart", onCompositionStart);
      addEventListener(el, "compositionend", onCompositionEnd);
      addEventListener(el, "change", onCompositionEnd);
    }
  },
  // set value on mounted so it's after min/max for type="range"
  mounted(el, { value }) {
    el.value = value == null ? "" : value;
  },
  beforeUpdate(el, { value, modifiers: { lazy, trim, number: number2 } }, vnode) {
    el[assignKey] = getModelAssigner(vnode);
    if (el.composing)
      return;
    const elValue = number2 || el.type === "number" ? looseToNumber(el.value) : el.value;
    const newValue = value == null ? "" : value;
    if (elValue === newValue) {
      return;
    }
    if (document.activeElement === el && el.type !== "range") {
      if (lazy) {
        return;
      }
      if (trim && el.value.trim() === newValue) {
        return;
      }
    }
    el.value = newValue;
  }
};
const vModelCheckbox = {
  // #4096 array checkboxes need to be deep traversed
  deep: true,
  created(el, _, vnode) {
    el[assignKey] = getModelAssigner(vnode);
    addEventListener(el, "change", () => {
      const modelValue = el._modelValue;
      const elementValue = getValue(el);
      const checked = el.checked;
      const assign2 = el[assignKey];
      if (isArray$1(modelValue)) {
        const index = looseIndexOf(modelValue, elementValue);
        const found = index !== -1;
        if (checked && !found) {
          assign2(modelValue.concat(elementValue));
        } else if (!checked && found) {
          const filtered = [...modelValue];
          filtered.splice(index, 1);
          assign2(filtered);
        }
      } else if (isSet(modelValue)) {
        const cloned = new Set(modelValue);
        if (checked) {
          cloned.add(elementValue);
        } else {
          cloned.delete(elementValue);
        }
        assign2(cloned);
      } else {
        assign2(getCheckboxValue(el, checked));
      }
    });
  },
  // set initial checked on mount to wait for true-value/false-value
  mounted: setChecked,
  beforeUpdate(el, binding, vnode) {
    el[assignKey] = getModelAssigner(vnode);
    setChecked(el, binding, vnode);
  }
};
function setChecked(el, { value, oldValue }, vnode) {
  el._modelValue = value;
  if (isArray$1(value)) {
    el.checked = looseIndexOf(value, vnode.props.value) > -1;
  } else if (isSet(value)) {
    el.checked = value.has(vnode.props.value);
  } else if (value !== oldValue) {
    el.checked = looseEqual(value, getCheckboxValue(el, true));
  }
}
const vModelSelect = {
  // <select multiple> value need to be deep traversed
  deep: true,
  created(el, { value, modifiers: { number: number2 } }, vnode) {
    const isSetModel = isSet(value);
    addEventListener(el, "change", () => {
      const selectedVal = Array.prototype.filter.call(el.options, (o) => o.selected).map(
        (o) => number2 ? looseToNumber(getValue(o)) : getValue(o)
      );
      el[assignKey](
        el.multiple ? isSetModel ? new Set(selectedVal) : selectedVal : selectedVal[0]
      );
      el._assigning = true;
      nextTick(() => {
        el._assigning = false;
      });
    });
    el[assignKey] = getModelAssigner(vnode);
  },
  // set value in mounted & updated because <select> relies on its children
  // <option>s.
  mounted(el, { value, oldValue, modifiers: { number: number2 } }) {
    setSelected(el, value, oldValue, number2);
  },
  beforeUpdate(el, _binding, vnode) {
    el[assignKey] = getModelAssigner(vnode);
  },
  updated(el, { value, oldValue, modifiers: { number: number2 } }) {
    if (!el._assigning) {
      setSelected(el, value, oldValue, number2);
    }
  }
};
function setSelected(el, value, oldValue, number2) {
  const isMultiple = el.multiple;
  const isArrayValue = isArray$1(value);
  if (isMultiple && !isArrayValue && !isSet(value)) {
    return;
  }
  for (let i2 = 0, l = el.options.length; i2 < l; i2++) {
    const option = el.options[i2];
    const optionValue = getValue(option);
    if (isMultiple) {
      if (isArrayValue) {
        const optionType = typeof optionValue;
        if (optionType === "string" || optionType === "number") {
          option.selected = value.includes(
            number2 ? looseToNumber(optionValue) : optionValue
          );
        } else {
          option.selected = looseIndexOf(value, optionValue) > -1;
        }
      } else {
        option.selected = value.has(optionValue);
      }
    } else {
      if (looseEqual(getValue(option), value)) {
        if (el.selectedIndex !== i2)
          el.selectedIndex = i2;
        return;
      }
    }
  }
  if (!isMultiple && el.selectedIndex !== -1) {
    el.selectedIndex = -1;
  }
}
function getValue(el) {
  return "_value" in el ? el._value : el.value;
}
function getCheckboxValue(el, checked) {
  const key = checked ? "_trueValue" : "_falseValue";
  return key in el ? el[key] : checked;
}
const systemModifiers = ["ctrl", "shift", "alt", "meta"];
const modifierGuards = {
  stop: (e) => e.stopPropagation(),
  prevent: (e) => e.preventDefault(),
  self: (e) => e.target !== e.currentTarget,
  ctrl: (e) => !e.ctrlKey,
  shift: (e) => !e.shiftKey,
  alt: (e) => !e.altKey,
  meta: (e) => !e.metaKey,
  left: (e) => "button" in e && e.button !== 0,
  middle: (e) => "button" in e && e.button !== 1,
  right: (e) => "button" in e && e.button !== 2,
  exact: (e, modifiers) => systemModifiers.some((m) => e[`${m}Key`] && !modifiers.includes(m))
};
const withModifiers = (fn, modifiers) => {
  const cache = fn._withMods || (fn._withMods = {});
  const cacheKey = modifiers.join(".");
  return cache[cacheKey] || (cache[cacheKey] = (event, ...args) => {
    for (let i2 = 0; i2 < modifiers.length; i2++) {
      const guard = modifierGuards[modifiers[i2]];
      if (guard && guard(event, modifiers))
        return;
    }
    return fn(event, ...args);
  });
};
const rendererOptions = /* @__PURE__ */ extend({ patchProp }, nodeOps);
let renderer;
function ensureRenderer() {
  return renderer || (renderer = createRenderer(rendererOptions));
}
const createApp = (...args) => {
  const app2 = ensureRenderer().createApp(...args);
  const { mount } = app2;
  app2.mount = (containerOrSelector) => {
    const container = normalizeContainer(containerOrSelector);
    if (!container)
      return;
    const component = app2._component;
    if (!isFunction(component) && !component.render && !component.template) {
      component.template = container.innerHTML;
    }
    container.innerHTML = "";
    const proxy = mount(container, false, resolveRootNamespace(container));
    if (container instanceof Element) {
      container.removeAttribute("v-cloak");
      container.setAttribute("data-v-app", "");
    }
    return proxy;
  };
  return app2;
};
function resolveRootNamespace(container) {
  if (container instanceof SVGElement) {
    return "svg";
  }
  if (typeof MathMLElement === "function" && container instanceof MathMLElement) {
    return "mathml";
  }
}
function normalizeContainer(container) {
  if (isString(container)) {
    const res = document.querySelector(container);
    return res;
  }
  return container;
}
var isVue2 = false;
/*!
 * pinia v2.1.7
 * (c) 2023 Eduardo San Martin Morote
 * @license MIT
 */
let activePinia;
const setActivePinia = (pinia2) => activePinia = pinia2;
const piniaSymbol = (
  /* istanbul ignore next */
  Symbol()
);
function isPlainObject(o) {
  return o && typeof o === "object" && Object.prototype.toString.call(o) === "[object Object]" && typeof o.toJSON !== "function";
}
var MutationType;
(function(MutationType2) {
  MutationType2["direct"] = "direct";
  MutationType2["patchObject"] = "patch object";
  MutationType2["patchFunction"] = "patch function";
})(MutationType || (MutationType = {}));
function createPinia() {
  const scope = effectScope(true);
  const state = scope.run(() => ref({}));
  let _p = [];
  let toBeInstalled = [];
  const pinia2 = markRaw({
    install(app2) {
      setActivePinia(pinia2);
      {
        pinia2._a = app2;
        app2.provide(piniaSymbol, pinia2);
        app2.config.globalProperties.$pinia = pinia2;
        toBeInstalled.forEach((plugin) => _p.push(plugin));
        toBeInstalled = [];
      }
    },
    use(plugin) {
      if (!this._a && !isVue2) {
        toBeInstalled.push(plugin);
      } else {
        _p.push(plugin);
      }
      return this;
    },
    _p,
    // it's actually undefined here
    // @ts-expect-error
    _a: null,
    _e: scope,
    _s: /* @__PURE__ */ new Map(),
    state
  });
  return pinia2;
}
const noop$1 = () => {
};
function addSubscription(subscriptions, callback, detached, onCleanup = noop$1) {
  subscriptions.push(callback);
  const removeSubscription = () => {
    const idx = subscriptions.indexOf(callback);
    if (idx > -1) {
      subscriptions.splice(idx, 1);
      onCleanup();
    }
  };
  if (!detached && getCurrentScope()) {
    onScopeDispose(removeSubscription);
  }
  return removeSubscription;
}
function triggerSubscriptions(subscriptions, ...args) {
  subscriptions.slice().forEach((callback) => {
    callback(...args);
  });
}
const fallbackRunWithContext = (fn) => fn();
function mergeReactiveObjects(target, patchToApply) {
  if (target instanceof Map && patchToApply instanceof Map) {
    patchToApply.forEach((value, key) => target.set(key, value));
  }
  if (target instanceof Set && patchToApply instanceof Set) {
    patchToApply.forEach(target.add, target);
  }
  for (const key in patchToApply) {
    if (!patchToApply.hasOwnProperty(key))
      continue;
    const subPatch = patchToApply[key];
    const targetValue = target[key];
    if (isPlainObject(targetValue) && isPlainObject(subPatch) && target.hasOwnProperty(key) && !isRef(subPatch) && !isReactive(subPatch)) {
      target[key] = mergeReactiveObjects(targetValue, subPatch);
    } else {
      target[key] = subPatch;
    }
  }
  return target;
}
const skipHydrateSymbol = (
  /* istanbul ignore next */
  Symbol()
);
function shouldHydrate(obj) {
  return !isPlainObject(obj) || !obj.hasOwnProperty(skipHydrateSymbol);
}
const { assign: assign$1 } = Object;
function isComputed(o) {
  return !!(isRef(o) && o.effect);
}
function createOptionsStore(id, options, pinia2, hot) {
  const { state, actions, getters } = options;
  const initialState = pinia2.state.value[id];
  let store;
  function setup() {
    if (!initialState && true) {
      {
        pinia2.state.value[id] = state ? state() : {};
      }
    }
    const localState = toRefs(pinia2.state.value[id]);
    return assign$1(localState, actions, Object.keys(getters || {}).reduce((computedGetters, name) => {
      computedGetters[name] = markRaw(computed(() => {
        setActivePinia(pinia2);
        const store2 = pinia2._s.get(id);
        return getters[name].call(store2, store2);
      }));
      return computedGetters;
    }, {}));
  }
  store = createSetupStore(id, setup, options, pinia2, hot, true);
  return store;
}
function createSetupStore($id, setup, options = {}, pinia2, hot, isOptionsStore) {
  let scope;
  const optionsForPlugin = assign$1({ actions: {} }, options);
  const $subscribeOptions = {
    deep: true
    // flush: 'post',
  };
  let isListening;
  let isSyncListening;
  let subscriptions = [];
  let actionSubscriptions = [];
  let debuggerEvents;
  const initialState = pinia2.state.value[$id];
  if (!isOptionsStore && !initialState && true) {
    {
      pinia2.state.value[$id] = {};
    }
  }
  ref({});
  let activeListener;
  function $patch(partialStateOrMutator) {
    let subscriptionMutation;
    isListening = isSyncListening = false;
    if (typeof partialStateOrMutator === "function") {
      partialStateOrMutator(pinia2.state.value[$id]);
      subscriptionMutation = {
        type: MutationType.patchFunction,
        storeId: $id,
        events: debuggerEvents
      };
    } else {
      mergeReactiveObjects(pinia2.state.value[$id], partialStateOrMutator);
      subscriptionMutation = {
        type: MutationType.patchObject,
        payload: partialStateOrMutator,
        storeId: $id,
        events: debuggerEvents
      };
    }
    const myListenerId = activeListener = Symbol();
    nextTick().then(() => {
      if (activeListener === myListenerId) {
        isListening = true;
      }
    });
    isSyncListening = true;
    triggerSubscriptions(subscriptions, subscriptionMutation, pinia2.state.value[$id]);
  }
  const $reset = isOptionsStore ? function $reset2() {
    const { state } = options;
    const newState = state ? state() : {};
    this.$patch(($state) => {
      assign$1($state, newState);
    });
  } : (
    /* istanbul ignore next */
    noop$1
  );
  function $dispose() {
    scope.stop();
    subscriptions = [];
    actionSubscriptions = [];
    pinia2._s.delete($id);
  }
  function wrapAction(name, action) {
    return function() {
      setActivePinia(pinia2);
      const args = Array.from(arguments);
      const afterCallbackList = [];
      const onErrorCallbackList = [];
      function after(callback) {
        afterCallbackList.push(callback);
      }
      function onError(callback) {
        onErrorCallbackList.push(callback);
      }
      triggerSubscriptions(actionSubscriptions, {
        args,
        name,
        store,
        after,
        onError
      });
      let ret;
      try {
        ret = action.apply(this && this.$id === $id ? this : store, args);
      } catch (error) {
        triggerSubscriptions(onErrorCallbackList, error);
        throw error;
      }
      if (ret instanceof Promise) {
        return ret.then((value) => {
          triggerSubscriptions(afterCallbackList, value);
          return value;
        }).catch((error) => {
          triggerSubscriptions(onErrorCallbackList, error);
          return Promise.reject(error);
        });
      }
      triggerSubscriptions(afterCallbackList, ret);
      return ret;
    };
  }
  const partialStore = {
    _p: pinia2,
    // _s: scope,
    $id,
    $onAction: addSubscription.bind(null, actionSubscriptions),
    $patch,
    $reset,
    $subscribe(callback, options2 = {}) {
      const removeSubscription = addSubscription(subscriptions, callback, options2.detached, () => stopWatcher());
      const stopWatcher = scope.run(() => watch(() => pinia2.state.value[$id], (state) => {
        if (options2.flush === "sync" ? isSyncListening : isListening) {
          callback({
            storeId: $id,
            type: MutationType.direct,
            events: debuggerEvents
          }, state);
        }
      }, assign$1({}, $subscribeOptions, options2)));
      return removeSubscription;
    },
    $dispose
  };
  const store = reactive(partialStore);
  pinia2._s.set($id, store);
  const runWithContext = pinia2._a && pinia2._a.runWithContext || fallbackRunWithContext;
  const setupStore = runWithContext(() => pinia2._e.run(() => (scope = effectScope()).run(setup)));
  for (const key in setupStore) {
    const prop = setupStore[key];
    if (isRef(prop) && !isComputed(prop) || isReactive(prop)) {
      if (!isOptionsStore) {
        if (initialState && shouldHydrate(prop)) {
          if (isRef(prop)) {
            prop.value = initialState[key];
          } else {
            mergeReactiveObjects(prop, initialState[key]);
          }
        }
        {
          pinia2.state.value[$id][key] = prop;
        }
      }
    } else if (typeof prop === "function") {
      const actionValue = wrapAction(key, prop);
      {
        setupStore[key] = actionValue;
      }
      optionsForPlugin.actions[key] = prop;
    } else
      ;
  }
  {
    assign$1(store, setupStore);
    assign$1(toRaw(store), setupStore);
  }
  Object.defineProperty(store, "$state", {
    get: () => pinia2.state.value[$id],
    set: (state) => {
      $patch(($state) => {
        assign$1($state, state);
      });
    }
  });
  pinia2._p.forEach((extender) => {
    {
      assign$1(store, scope.run(() => extender({
        store,
        app: pinia2._a,
        pinia: pinia2,
        options: optionsForPlugin
      })));
    }
  });
  if (initialState && isOptionsStore && options.hydrate) {
    options.hydrate(store.$state, initialState);
  }
  isListening = true;
  isSyncListening = true;
  return store;
}
function defineStore(idOrOptions, setup, setupOptions) {
  let id;
  let options;
  const isSetupStore = typeof setup === "function";
  if (typeof idOrOptions === "string") {
    id = idOrOptions;
    options = isSetupStore ? setupOptions : setup;
  } else {
    options = idOrOptions;
    id = idOrOptions.id;
  }
  function useStore(pinia2, hot) {
    const hasContext = hasInjectionContext();
    pinia2 = // in test mode, ignore the argument provided as we can always retrieve a
    // pinia instance with getActivePinia()
    pinia2 || (hasContext ? inject(piniaSymbol, null) : null);
    if (pinia2)
      setActivePinia(pinia2);
    pinia2 = activePinia;
    if (!pinia2._s.has(id)) {
      if (isSetupStore) {
        createSetupStore(id, setup, options, pinia2);
      } else {
        createOptionsStore(id, options, pinia2);
      }
    }
    const store = pinia2._s.get(id);
    return store;
  }
  useStore.$id = id;
  return useStore;
}
/*!
  * vue-router v4.2.5
  * (c) 2023 Eduardo San Martin Morote
  * @license MIT
  */
const isBrowser = typeof window !== "undefined";
function isESModule(obj) {
  return obj.__esModule || obj[Symbol.toStringTag] === "Module";
}
const assign = Object.assign;
function applyToParams(fn, params) {
  const newParams = {};
  for (const key in params) {
    const value = params[key];
    newParams[key] = isArray(value) ? value.map(fn) : fn(value);
  }
  return newParams;
}
const noop = () => {
};
const isArray = Array.isArray;
const TRAILING_SLASH_RE = /\/$/;
const removeTrailingSlash = (path) => path.replace(TRAILING_SLASH_RE, "");
function parseURL(parseQuery2, location2, currentLocation = "/") {
  let path, query = {}, searchString = "", hash2 = "";
  const hashPos = location2.indexOf("#");
  let searchPos = location2.indexOf("?");
  if (hashPos < searchPos && hashPos >= 0) {
    searchPos = -1;
  }
  if (searchPos > -1) {
    path = location2.slice(0, searchPos);
    searchString = location2.slice(searchPos + 1, hashPos > -1 ? hashPos : location2.length);
    query = parseQuery2(searchString);
  }
  if (hashPos > -1) {
    path = path || location2.slice(0, hashPos);
    hash2 = location2.slice(hashPos, location2.length);
  }
  path = resolveRelativePath(path != null ? path : location2, currentLocation);
  return {
    fullPath: path + (searchString && "?") + searchString + hash2,
    path,
    query,
    hash: hash2
  };
}
function stringifyURL(stringifyQuery2, location2) {
  const query = location2.query ? stringifyQuery2(location2.query) : "";
  return location2.path + (query && "?") + query + (location2.hash || "");
}
function stripBase(pathname, base) {
  if (!base || !pathname.toLowerCase().startsWith(base.toLowerCase()))
    return pathname;
  return pathname.slice(base.length) || "/";
}
function isSameRouteLocation(stringifyQuery2, a, b) {
  const aLastIndex = a.matched.length - 1;
  const bLastIndex = b.matched.length - 1;
  return aLastIndex > -1 && aLastIndex === bLastIndex && isSameRouteRecord(a.matched[aLastIndex], b.matched[bLastIndex]) && isSameRouteLocationParams(a.params, b.params) && stringifyQuery2(a.query) === stringifyQuery2(b.query) && a.hash === b.hash;
}
function isSameRouteRecord(a, b) {
  return (a.aliasOf || a) === (b.aliasOf || b);
}
function isSameRouteLocationParams(a, b) {
  if (Object.keys(a).length !== Object.keys(b).length)
    return false;
  for (const key in a) {
    if (!isSameRouteLocationParamsValue(a[key], b[key]))
      return false;
  }
  return true;
}
function isSameRouteLocationParamsValue(a, b) {
  return isArray(a) ? isEquivalentArray(a, b) : isArray(b) ? isEquivalentArray(b, a) : a === b;
}
function isEquivalentArray(a, b) {
  return isArray(b) ? a.length === b.length && a.every((value, i2) => value === b[i2]) : a.length === 1 && a[0] === b;
}
function resolveRelativePath(to, from) {
  if (to.startsWith("/"))
    return to;
  if (!to)
    return from;
  const fromSegments = from.split("/");
  const toSegments = to.split("/");
  const lastToSegment = toSegments[toSegments.length - 1];
  if (lastToSegment === ".." || lastToSegment === ".") {
    toSegments.push("");
  }
  let position = fromSegments.length - 1;
  let toPosition;
  let segment;
  for (toPosition = 0; toPosition < toSegments.length; toPosition++) {
    segment = toSegments[toPosition];
    if (segment === ".")
      continue;
    if (segment === "..") {
      if (position > 1)
        position--;
    } else
      break;
  }
  return fromSegments.slice(0, position).join("/") + "/" + toSegments.slice(toPosition - (toPosition === toSegments.length ? 1 : 0)).join("/");
}
var NavigationType;
(function(NavigationType2) {
  NavigationType2["pop"] = "pop";
  NavigationType2["push"] = "push";
})(NavigationType || (NavigationType = {}));
var NavigationDirection;
(function(NavigationDirection2) {
  NavigationDirection2["back"] = "back";
  NavigationDirection2["forward"] = "forward";
  NavigationDirection2["unknown"] = "";
})(NavigationDirection || (NavigationDirection = {}));
function normalizeBase(base) {
  if (!base) {
    if (isBrowser) {
      const baseEl = document.querySelector("base");
      base = baseEl && baseEl.getAttribute("href") || "/";
      base = base.replace(/^\w+:\/\/[^\/]+/, "");
    } else {
      base = "/";
    }
  }
  if (base[0] !== "/" && base[0] !== "#")
    base = "/" + base;
  return removeTrailingSlash(base);
}
const BEFORE_HASH_RE = /^[^#]+#/;
function createHref(base, location2) {
  return base.replace(BEFORE_HASH_RE, "#") + location2;
}
function getElementPosition(el, offset) {
  const docRect = document.documentElement.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  return {
    behavior: offset.behavior,
    left: elRect.left - docRect.left - (offset.left || 0),
    top: elRect.top - docRect.top - (offset.top || 0)
  };
}
const computeScrollPosition = () => ({
  left: window.pageXOffset,
  top: window.pageYOffset
});
function scrollToPosition(position) {
  let scrollToOptions;
  if ("el" in position) {
    const positionEl = position.el;
    const isIdSelector = typeof positionEl === "string" && positionEl.startsWith("#");
    const el = typeof positionEl === "string" ? isIdSelector ? document.getElementById(positionEl.slice(1)) : document.querySelector(positionEl) : positionEl;
    if (!el) {
      return;
    }
    scrollToOptions = getElementPosition(el, position);
  } else {
    scrollToOptions = position;
  }
  if ("scrollBehavior" in document.documentElement.style)
    window.scrollTo(scrollToOptions);
  else {
    window.scrollTo(scrollToOptions.left != null ? scrollToOptions.left : window.pageXOffset, scrollToOptions.top != null ? scrollToOptions.top : window.pageYOffset);
  }
}
function getScrollKey(path, delta) {
  const position = history.state ? history.state.position - delta : -1;
  return position + path;
}
const scrollPositions = /* @__PURE__ */ new Map();
function saveScrollPosition(key, scrollPosition) {
  scrollPositions.set(key, scrollPosition);
}
function getSavedScrollPosition(key) {
  const scroll = scrollPositions.get(key);
  scrollPositions.delete(key);
  return scroll;
}
let createBaseLocation = () => location.protocol + "//" + location.host;
function createCurrentLocation(base, location2) {
  const { pathname, search, hash: hash2 } = location2;
  const hashPos = base.indexOf("#");
  if (hashPos > -1) {
    let slicePos = hash2.includes(base.slice(hashPos)) ? base.slice(hashPos).length : 1;
    let pathFromHash = hash2.slice(slicePos);
    if (pathFromHash[0] !== "/")
      pathFromHash = "/" + pathFromHash;
    return stripBase(pathFromHash, "");
  }
  const path = stripBase(pathname, base);
  return path + search + hash2;
}
function useHistoryListeners(base, historyState, currentLocation, replace) {
  let listeners = [];
  let teardowns = [];
  let pauseState = null;
  const popStateHandler = ({ state }) => {
    const to = createCurrentLocation(base, location);
    const from = currentLocation.value;
    const fromState = historyState.value;
    let delta = 0;
    if (state) {
      currentLocation.value = to;
      historyState.value = state;
      if (pauseState && pauseState === from) {
        pauseState = null;
        return;
      }
      delta = fromState ? state.position - fromState.position : 0;
    } else {
      replace(to);
    }
    listeners.forEach((listener) => {
      listener(currentLocation.value, from, {
        delta,
        type: NavigationType.pop,
        direction: delta ? delta > 0 ? NavigationDirection.forward : NavigationDirection.back : NavigationDirection.unknown
      });
    });
  };
  function pauseListeners() {
    pauseState = currentLocation.value;
  }
  function listen(callback) {
    listeners.push(callback);
    const teardown = () => {
      const index = listeners.indexOf(callback);
      if (index > -1)
        listeners.splice(index, 1);
    };
    teardowns.push(teardown);
    return teardown;
  }
  function beforeUnloadListener() {
    const { history: history2 } = window;
    if (!history2.state)
      return;
    history2.replaceState(assign({}, history2.state, { scroll: computeScrollPosition() }), "");
  }
  function destroy() {
    for (const teardown of teardowns)
      teardown();
    teardowns = [];
    window.removeEventListener("popstate", popStateHandler);
    window.removeEventListener("beforeunload", beforeUnloadListener);
  }
  window.addEventListener("popstate", popStateHandler);
  window.addEventListener("beforeunload", beforeUnloadListener, {
    passive: true
  });
  return {
    pauseListeners,
    listen,
    destroy
  };
}
function buildState(back, current, forward, replaced = false, computeScroll = false) {
  return {
    back,
    current,
    forward,
    replaced,
    position: window.history.length,
    scroll: computeScroll ? computeScrollPosition() : null
  };
}
function useHistoryStateNavigation(base) {
  const { history: history2, location: location2 } = window;
  const currentLocation = {
    value: createCurrentLocation(base, location2)
  };
  const historyState = { value: history2.state };
  if (!historyState.value) {
    changeLocation(currentLocation.value, {
      back: null,
      current: currentLocation.value,
      forward: null,
      // the length is off by one, we need to decrease it
      position: history2.length - 1,
      replaced: true,
      // don't add a scroll as the user may have an anchor, and we want
      // scrollBehavior to be triggered without a saved position
      scroll: null
    }, true);
  }
  function changeLocation(to, state, replace2) {
    const hashIndex = base.indexOf("#");
    const url = hashIndex > -1 ? (location2.host && document.querySelector("base") ? base : base.slice(hashIndex)) + to : createBaseLocation() + base + to;
    try {
      history2[replace2 ? "replaceState" : "pushState"](state, "", url);
      historyState.value = state;
    } catch (err) {
      {
        console.error(err);
      }
      location2[replace2 ? "replace" : "assign"](url);
    }
  }
  function replace(to, data) {
    const state = assign({}, history2.state, buildState(
      historyState.value.back,
      // keep back and forward entries but override current position
      to,
      historyState.value.forward,
      true
    ), data, { position: historyState.value.position });
    changeLocation(to, state, true);
    currentLocation.value = to;
  }
  function push(to, data) {
    const currentState = assign(
      {},
      // use current history state to gracefully handle a wrong call to
      // history.replaceState
      // https://github.com/vuejs/router/issues/366
      historyState.value,
      history2.state,
      {
        forward: to,
        scroll: computeScrollPosition()
      }
    );
    changeLocation(currentState.current, currentState, true);
    const state = assign({}, buildState(currentLocation.value, to, null), { position: currentState.position + 1 }, data);
    changeLocation(to, state, false);
    currentLocation.value = to;
  }
  return {
    location: currentLocation,
    state: historyState,
    push,
    replace
  };
}
function createWebHistory(base) {
  base = normalizeBase(base);
  const historyNavigation = useHistoryStateNavigation(base);
  const historyListeners = useHistoryListeners(base, historyNavigation.state, historyNavigation.location, historyNavigation.replace);
  function go(delta, triggerListeners = true) {
    if (!triggerListeners)
      historyListeners.pauseListeners();
    history.go(delta);
  }
  const routerHistory = assign({
    // it's overridden right after
    location: "",
    base,
    go,
    createHref: createHref.bind(null, base)
  }, historyNavigation, historyListeners);
  Object.defineProperty(routerHistory, "location", {
    enumerable: true,
    get: () => historyNavigation.location.value
  });
  Object.defineProperty(routerHistory, "state", {
    enumerable: true,
    get: () => historyNavigation.state.value
  });
  return routerHistory;
}
function createWebHashHistory(base) {
  base = location.host ? base || location.pathname + location.search : "";
  if (!base.includes("#"))
    base += "#";
  return createWebHistory(base);
}
function isRouteLocation(route) {
  return typeof route === "string" || route && typeof route === "object";
}
function isRouteName(name) {
  return typeof name === "string" || typeof name === "symbol";
}
const START_LOCATION_NORMALIZED = {
  path: "/",
  name: void 0,
  params: {},
  query: {},
  hash: "",
  fullPath: "/",
  matched: [],
  meta: {},
  redirectedFrom: void 0
};
const NavigationFailureSymbol = Symbol("");
var NavigationFailureType;
(function(NavigationFailureType2) {
  NavigationFailureType2[NavigationFailureType2["aborted"] = 4] = "aborted";
  NavigationFailureType2[NavigationFailureType2["cancelled"] = 8] = "cancelled";
  NavigationFailureType2[NavigationFailureType2["duplicated"] = 16] = "duplicated";
})(NavigationFailureType || (NavigationFailureType = {}));
function createRouterError(type, params) {
  {
    return assign(new Error(), {
      type,
      [NavigationFailureSymbol]: true
    }, params);
  }
}
function isNavigationFailure(error, type) {
  return error instanceof Error && NavigationFailureSymbol in error && (type == null || !!(error.type & type));
}
const BASE_PARAM_PATTERN = "[^/]+?";
const BASE_PATH_PARSER_OPTIONS = {
  sensitive: false,
  strict: false,
  start: true,
  end: true
};
const REGEX_CHARS_RE = /[.+*?^${}()[\]/\\]/g;
function tokensToParser(segments, extraOptions) {
  const options = assign({}, BASE_PATH_PARSER_OPTIONS, extraOptions);
  const score = [];
  let pattern = options.start ? "^" : "";
  const keys = [];
  for (const segment of segments) {
    const segmentScores = segment.length ? [] : [
      90
      /* PathScore.Root */
    ];
    if (options.strict && !segment.length)
      pattern += "/";
    for (let tokenIndex = 0; tokenIndex < segment.length; tokenIndex++) {
      const token = segment[tokenIndex];
      let subSegmentScore = 40 + (options.sensitive ? 0.25 : 0);
      if (token.type === 0) {
        if (!tokenIndex)
          pattern += "/";
        pattern += token.value.replace(REGEX_CHARS_RE, "\\$&");
        subSegmentScore += 40;
      } else if (token.type === 1) {
        const { value, repeatable, optional, regexp } = token;
        keys.push({
          name: value,
          repeatable,
          optional
        });
        const re2 = regexp ? regexp : BASE_PARAM_PATTERN;
        if (re2 !== BASE_PARAM_PATTERN) {
          subSegmentScore += 10;
          try {
            new RegExp(`(${re2})`);
          } catch (err) {
            throw new Error(`Invalid custom RegExp for param "${value}" (${re2}): ` + err.message);
          }
        }
        let subPattern = repeatable ? `((?:${re2})(?:/(?:${re2}))*)` : `(${re2})`;
        if (!tokenIndex)
          subPattern = // avoid an optional / if there are more segments e.g. /:p?-static
          // or /:p?-:p2
          optional && segment.length < 2 ? `(?:/${subPattern})` : "/" + subPattern;
        if (optional)
          subPattern += "?";
        pattern += subPattern;
        subSegmentScore += 20;
        if (optional)
          subSegmentScore += -8;
        if (repeatable)
          subSegmentScore += -20;
        if (re2 === ".*")
          subSegmentScore += -50;
      }
      segmentScores.push(subSegmentScore);
    }
    score.push(segmentScores);
  }
  if (options.strict && options.end) {
    const i2 = score.length - 1;
    score[i2][score[i2].length - 1] += 0.7000000000000001;
  }
  if (!options.strict)
    pattern += "/?";
  if (options.end)
    pattern += "$";
  else if (options.strict)
    pattern += "(?:/|$)";
  const re = new RegExp(pattern, options.sensitive ? "" : "i");
  function parse3(path) {
    const match = path.match(re);
    const params = {};
    if (!match)
      return null;
    for (let i2 = 1; i2 < match.length; i2++) {
      const value = match[i2] || "";
      const key = keys[i2 - 1];
      params[key.name] = value && key.repeatable ? value.split("/") : value;
    }
    return params;
  }
  function stringify(params) {
    let path = "";
    let avoidDuplicatedSlash = false;
    for (const segment of segments) {
      if (!avoidDuplicatedSlash || !path.endsWith("/"))
        path += "/";
      avoidDuplicatedSlash = false;
      for (const token of segment) {
        if (token.type === 0) {
          path += token.value;
        } else if (token.type === 1) {
          const { value, repeatable, optional } = token;
          const param = value in params ? params[value] : "";
          if (isArray(param) && !repeatable) {
            throw new Error(`Provided param "${value}" is an array but it is not repeatable (* or + modifiers)`);
          }
          const text = isArray(param) ? param.join("/") : param;
          if (!text) {
            if (optional) {
              if (segment.length < 2) {
                if (path.endsWith("/"))
                  path = path.slice(0, -1);
                else
                  avoidDuplicatedSlash = true;
              }
            } else
              throw new Error(`Missing required param "${value}"`);
          }
          path += text;
        }
      }
    }
    return path || "/";
  }
  return {
    re,
    score,
    keys,
    parse: parse3,
    stringify
  };
}
function compareScoreArray(a, b) {
  let i2 = 0;
  while (i2 < a.length && i2 < b.length) {
    const diff = b[i2] - a[i2];
    if (diff)
      return diff;
    i2++;
  }
  if (a.length < b.length) {
    return a.length === 1 && a[0] === 40 + 40 ? -1 : 1;
  } else if (a.length > b.length) {
    return b.length === 1 && b[0] === 40 + 40 ? 1 : -1;
  }
  return 0;
}
function comparePathParserScore(a, b) {
  let i2 = 0;
  const aScore = a.score;
  const bScore = b.score;
  while (i2 < aScore.length && i2 < bScore.length) {
    const comp = compareScoreArray(aScore[i2], bScore[i2]);
    if (comp)
      return comp;
    i2++;
  }
  if (Math.abs(bScore.length - aScore.length) === 1) {
    if (isLastScoreNegative(aScore))
      return 1;
    if (isLastScoreNegative(bScore))
      return -1;
  }
  return bScore.length - aScore.length;
}
function isLastScoreNegative(score) {
  const last = score[score.length - 1];
  return score.length > 0 && last[last.length - 1] < 0;
}
const ROOT_TOKEN = {
  type: 0,
  value: ""
};
const VALID_PARAM_RE = /[a-zA-Z0-9_]/;
function tokenizePath(path) {
  if (!path)
    return [[]];
  if (path === "/")
    return [[ROOT_TOKEN]];
  if (!path.startsWith("/")) {
    throw new Error(`Invalid path "${path}"`);
  }
  function crash(message) {
    throw new Error(`ERR (${state})/"${buffer}": ${message}`);
  }
  let state = 0;
  let previousState = state;
  const tokens = [];
  let segment;
  function finalizeSegment() {
    if (segment)
      tokens.push(segment);
    segment = [];
  }
  let i2 = 0;
  let char;
  let buffer = "";
  let customRe = "";
  function consumeBuffer() {
    if (!buffer)
      return;
    if (state === 0) {
      segment.push({
        type: 0,
        value: buffer
      });
    } else if (state === 1 || state === 2 || state === 3) {
      if (segment.length > 1 && (char === "*" || char === "+"))
        crash(`A repeatable param (${buffer}) must be alone in its segment. eg: '/:ids+.`);
      segment.push({
        type: 1,
        value: buffer,
        regexp: customRe,
        repeatable: char === "*" || char === "+",
        optional: char === "*" || char === "?"
      });
    } else {
      crash("Invalid state to consume buffer");
    }
    buffer = "";
  }
  function addCharToBuffer() {
    buffer += char;
  }
  while (i2 < path.length) {
    char = path[i2++];
    if (char === "\\" && state !== 2) {
      previousState = state;
      state = 4;
      continue;
    }
    switch (state) {
      case 0:
        if (char === "/") {
          if (buffer) {
            consumeBuffer();
          }
          finalizeSegment();
        } else if (char === ":") {
          consumeBuffer();
          state = 1;
        } else {
          addCharToBuffer();
        }
        break;
      case 4:
        addCharToBuffer();
        state = previousState;
        break;
      case 1:
        if (char === "(") {
          state = 2;
        } else if (VALID_PARAM_RE.test(char)) {
          addCharToBuffer();
        } else {
          consumeBuffer();
          state = 0;
          if (char !== "*" && char !== "?" && char !== "+")
            i2--;
        }
        break;
      case 2:
        if (char === ")") {
          if (customRe[customRe.length - 1] == "\\")
            customRe = customRe.slice(0, -1) + char;
          else
            state = 3;
        } else {
          customRe += char;
        }
        break;
      case 3:
        consumeBuffer();
        state = 0;
        if (char !== "*" && char !== "?" && char !== "+")
          i2--;
        customRe = "";
        break;
      default:
        crash("Unknown state");
        break;
    }
  }
  if (state === 2)
    crash(`Unfinished custom RegExp for param "${buffer}"`);
  consumeBuffer();
  finalizeSegment();
  return tokens;
}
function createRouteRecordMatcher(record, parent, options) {
  const parser = tokensToParser(tokenizePath(record.path), options);
  const matcher = assign(parser, {
    record,
    parent,
    // these needs to be populated by the parent
    children: [],
    alias: []
  });
  if (parent) {
    if (!matcher.record.aliasOf === !parent.record.aliasOf)
      parent.children.push(matcher);
  }
  return matcher;
}
function createRouterMatcher(routes2, globalOptions) {
  const matchers = [];
  const matcherMap = /* @__PURE__ */ new Map();
  globalOptions = mergeOptions({ strict: false, end: true, sensitive: false }, globalOptions);
  function getRecordMatcher(name) {
    return matcherMap.get(name);
  }
  function addRoute(record, parent, originalRecord) {
    const isRootAdd = !originalRecord;
    const mainNormalizedRecord = normalizeRouteRecord(record);
    mainNormalizedRecord.aliasOf = originalRecord && originalRecord.record;
    const options = mergeOptions(globalOptions, record);
    const normalizedRecords = [
      mainNormalizedRecord
    ];
    if ("alias" in record) {
      const aliases = typeof record.alias === "string" ? [record.alias] : record.alias;
      for (const alias of aliases) {
        normalizedRecords.push(assign({}, mainNormalizedRecord, {
          // this allows us to hold a copy of the `components` option
          // so that async components cache is hold on the original record
          components: originalRecord ? originalRecord.record.components : mainNormalizedRecord.components,
          path: alias,
          // we might be the child of an alias
          aliasOf: originalRecord ? originalRecord.record : mainNormalizedRecord
          // the aliases are always of the same kind as the original since they
          // are defined on the same record
        }));
      }
    }
    let matcher;
    let originalMatcher;
    for (const normalizedRecord of normalizedRecords) {
      const { path } = normalizedRecord;
      if (parent && path[0] !== "/") {
        const parentPath = parent.record.path;
        const connectingSlash = parentPath[parentPath.length - 1] === "/" ? "" : "/";
        normalizedRecord.path = parent.record.path + (path && connectingSlash + path);
      }
      matcher = createRouteRecordMatcher(normalizedRecord, parent, options);
      if (originalRecord) {
        originalRecord.alias.push(matcher);
      } else {
        originalMatcher = originalMatcher || matcher;
        if (originalMatcher !== matcher)
          originalMatcher.alias.push(matcher);
        if (isRootAdd && record.name && !isAliasRecord(matcher))
          removeRoute(record.name);
      }
      if (mainNormalizedRecord.children) {
        const children = mainNormalizedRecord.children;
        for (let i2 = 0; i2 < children.length; i2++) {
          addRoute(children[i2], matcher, originalRecord && originalRecord.children[i2]);
        }
      }
      originalRecord = originalRecord || matcher;
      if (matcher.record.components && Object.keys(matcher.record.components).length || matcher.record.name || matcher.record.redirect) {
        insertMatcher(matcher);
      }
    }
    return originalMatcher ? () => {
      removeRoute(originalMatcher);
    } : noop;
  }
  function removeRoute(matcherRef) {
    if (isRouteName(matcherRef)) {
      const matcher = matcherMap.get(matcherRef);
      if (matcher) {
        matcherMap.delete(matcherRef);
        matchers.splice(matchers.indexOf(matcher), 1);
        matcher.children.forEach(removeRoute);
        matcher.alias.forEach(removeRoute);
      }
    } else {
      const index = matchers.indexOf(matcherRef);
      if (index > -1) {
        matchers.splice(index, 1);
        if (matcherRef.record.name)
          matcherMap.delete(matcherRef.record.name);
        matcherRef.children.forEach(removeRoute);
        matcherRef.alias.forEach(removeRoute);
      }
    }
  }
  function getRoutes() {
    return matchers;
  }
  function insertMatcher(matcher) {
    let i2 = 0;
    while (i2 < matchers.length && comparePathParserScore(matcher, matchers[i2]) >= 0 && // Adding children with empty path should still appear before the parent
    // https://github.com/vuejs/router/issues/1124
    (matcher.record.path !== matchers[i2].record.path || !isRecordChildOf(matcher, matchers[i2])))
      i2++;
    matchers.splice(i2, 0, matcher);
    if (matcher.record.name && !isAliasRecord(matcher))
      matcherMap.set(matcher.record.name, matcher);
  }
  function resolve2(location2, currentLocation) {
    let matcher;
    let params = {};
    let path;
    let name;
    if ("name" in location2 && location2.name) {
      matcher = matcherMap.get(location2.name);
      if (!matcher)
        throw createRouterError(1, {
          location: location2
        });
      name = matcher.record.name;
      params = assign(
        // paramsFromLocation is a new object
        paramsFromLocation(
          currentLocation.params,
          // only keep params that exist in the resolved location
          // TODO: only keep optional params coming from a parent record
          matcher.keys.filter((k) => !k.optional).map((k) => k.name)
        ),
        // discard any existing params in the current location that do not exist here
        // #1497 this ensures better active/exact matching
        location2.params && paramsFromLocation(location2.params, matcher.keys.map((k) => k.name))
      );
      path = matcher.stringify(params);
    } else if ("path" in location2) {
      path = location2.path;
      matcher = matchers.find((m) => m.re.test(path));
      if (matcher) {
        params = matcher.parse(path);
        name = matcher.record.name;
      }
    } else {
      matcher = currentLocation.name ? matcherMap.get(currentLocation.name) : matchers.find((m) => m.re.test(currentLocation.path));
      if (!matcher)
        throw createRouterError(1, {
          location: location2,
          currentLocation
        });
      name = matcher.record.name;
      params = assign({}, currentLocation.params, location2.params);
      path = matcher.stringify(params);
    }
    const matched = [];
    let parentMatcher = matcher;
    while (parentMatcher) {
      matched.unshift(parentMatcher.record);
      parentMatcher = parentMatcher.parent;
    }
    return {
      name,
      path,
      params,
      matched,
      meta: mergeMetaFields(matched)
    };
  }
  routes2.forEach((route) => addRoute(route));
  return { addRoute, resolve: resolve2, removeRoute, getRoutes, getRecordMatcher };
}
function paramsFromLocation(params, keys) {
  const newParams = {};
  for (const key of keys) {
    if (key in params)
      newParams[key] = params[key];
  }
  return newParams;
}
function normalizeRouteRecord(record) {
  return {
    path: record.path,
    redirect: record.redirect,
    name: record.name,
    meta: record.meta || {},
    aliasOf: void 0,
    beforeEnter: record.beforeEnter,
    props: normalizeRecordProps(record),
    children: record.children || [],
    instances: {},
    leaveGuards: /* @__PURE__ */ new Set(),
    updateGuards: /* @__PURE__ */ new Set(),
    enterCallbacks: {},
    components: "components" in record ? record.components || null : record.component && { default: record.component }
  };
}
function normalizeRecordProps(record) {
  const propsObject = {};
  const props = record.props || false;
  if ("component" in record) {
    propsObject.default = props;
  } else {
    for (const name in record.components)
      propsObject[name] = typeof props === "object" ? props[name] : props;
  }
  return propsObject;
}
function isAliasRecord(record) {
  while (record) {
    if (record.record.aliasOf)
      return true;
    record = record.parent;
  }
  return false;
}
function mergeMetaFields(matched) {
  return matched.reduce((meta, record) => assign(meta, record.meta), {});
}
function mergeOptions(defaults, partialOptions) {
  const options = {};
  for (const key in defaults) {
    options[key] = key in partialOptions ? partialOptions[key] : defaults[key];
  }
  return options;
}
function isRecordChildOf(record, parent) {
  return parent.children.some((child) => child === record || isRecordChildOf(record, child));
}
const HASH_RE = /#/g;
const AMPERSAND_RE = /&/g;
const SLASH_RE = /\//g;
const EQUAL_RE = /=/g;
const IM_RE = /\?/g;
const PLUS_RE = /\+/g;
const ENC_BRACKET_OPEN_RE = /%5B/g;
const ENC_BRACKET_CLOSE_RE = /%5D/g;
const ENC_CARET_RE = /%5E/g;
const ENC_BACKTICK_RE = /%60/g;
const ENC_CURLY_OPEN_RE = /%7B/g;
const ENC_PIPE_RE = /%7C/g;
const ENC_CURLY_CLOSE_RE = /%7D/g;
const ENC_SPACE_RE = /%20/g;
function commonEncode(text) {
  return encodeURI("" + text).replace(ENC_PIPE_RE, "|").replace(ENC_BRACKET_OPEN_RE, "[").replace(ENC_BRACKET_CLOSE_RE, "]");
}
function encodeHash(text) {
  return commonEncode(text).replace(ENC_CURLY_OPEN_RE, "{").replace(ENC_CURLY_CLOSE_RE, "}").replace(ENC_CARET_RE, "^");
}
function encodeQueryValue(text) {
  return commonEncode(text).replace(PLUS_RE, "%2B").replace(ENC_SPACE_RE, "+").replace(HASH_RE, "%23").replace(AMPERSAND_RE, "%26").replace(ENC_BACKTICK_RE, "`").replace(ENC_CURLY_OPEN_RE, "{").replace(ENC_CURLY_CLOSE_RE, "}").replace(ENC_CARET_RE, "^");
}
function encodeQueryKey(text) {
  return encodeQueryValue(text).replace(EQUAL_RE, "%3D");
}
function encodePath(text) {
  return commonEncode(text).replace(HASH_RE, "%23").replace(IM_RE, "%3F");
}
function encodeParam(text) {
  return text == null ? "" : encodePath(text).replace(SLASH_RE, "%2F");
}
function decode$1(text) {
  try {
    return decodeURIComponent("" + text);
  } catch (err) {
  }
  return "" + text;
}
function parseQuery(search) {
  const query = {};
  if (search === "" || search === "?")
    return query;
  const hasLeadingIM = search[0] === "?";
  const searchParams = (hasLeadingIM ? search.slice(1) : search).split("&");
  for (let i2 = 0; i2 < searchParams.length; ++i2) {
    const searchParam = searchParams[i2].replace(PLUS_RE, " ");
    const eqPos = searchParam.indexOf("=");
    const key = decode$1(eqPos < 0 ? searchParam : searchParam.slice(0, eqPos));
    const value = eqPos < 0 ? null : decode$1(searchParam.slice(eqPos + 1));
    if (key in query) {
      let currentValue = query[key];
      if (!isArray(currentValue)) {
        currentValue = query[key] = [currentValue];
      }
      currentValue.push(value);
    } else {
      query[key] = value;
    }
  }
  return query;
}
function stringifyQuery(query) {
  let search = "";
  for (let key in query) {
    const value = query[key];
    key = encodeQueryKey(key);
    if (value == null) {
      if (value !== void 0) {
        search += (search.length ? "&" : "") + key;
      }
      continue;
    }
    const values = isArray(value) ? value.map((v) => v && encodeQueryValue(v)) : [value && encodeQueryValue(value)];
    values.forEach((value2) => {
      if (value2 !== void 0) {
        search += (search.length ? "&" : "") + key;
        if (value2 != null)
          search += "=" + value2;
      }
    });
  }
  return search;
}
function normalizeQuery(query) {
  const normalizedQuery = {};
  for (const key in query) {
    const value = query[key];
    if (value !== void 0) {
      normalizedQuery[key] = isArray(value) ? value.map((v) => v == null ? null : "" + v) : value == null ? value : "" + value;
    }
  }
  return normalizedQuery;
}
const matchedRouteKey = Symbol("");
const viewDepthKey = Symbol("");
const routerKey = Symbol("");
const routeLocationKey = Symbol("");
const routerViewLocationKey = Symbol("");
function useCallbacks() {
  let handlers = [];
  function add2(handler) {
    handlers.push(handler);
    return () => {
      const i2 = handlers.indexOf(handler);
      if (i2 > -1)
        handlers.splice(i2, 1);
    };
  }
  function reset() {
    handlers = [];
  }
  return {
    add: add2,
    list: () => handlers.slice(),
    reset
  };
}
function guardToPromiseFn(guard, to, from, record, name) {
  const enterCallbackArray = record && // name is defined if record is because of the function overload
  (record.enterCallbacks[name] = record.enterCallbacks[name] || []);
  return () => new Promise((resolve2, reject) => {
    const next = (valid) => {
      if (valid === false) {
        reject(createRouterError(4, {
          from,
          to
        }));
      } else if (valid instanceof Error) {
        reject(valid);
      } else if (isRouteLocation(valid)) {
        reject(createRouterError(2, {
          from: to,
          to: valid
        }));
      } else {
        if (enterCallbackArray && // since enterCallbackArray is truthy, both record and name also are
        record.enterCallbacks[name] === enterCallbackArray && typeof valid === "function") {
          enterCallbackArray.push(valid);
        }
        resolve2();
      }
    };
    const guardReturn = guard.call(record && record.instances[name], to, from, next);
    let guardCall = Promise.resolve(guardReturn);
    if (guard.length < 3)
      guardCall = guardCall.then(next);
    guardCall.catch((err) => reject(err));
  });
}
function extractComponentsGuards(matched, guardType, to, from) {
  const guards = [];
  for (const record of matched) {
    for (const name in record.components) {
      let rawComponent = record.components[name];
      if (guardType !== "beforeRouteEnter" && !record.instances[name])
        continue;
      if (isRouteComponent(rawComponent)) {
        const options = rawComponent.__vccOpts || rawComponent;
        const guard = options[guardType];
        guard && guards.push(guardToPromiseFn(guard, to, from, record, name));
      } else {
        let componentPromise = rawComponent();
        guards.push(() => componentPromise.then((resolved) => {
          if (!resolved)
            return Promise.reject(new Error(`Couldn't resolve component "${name}" at "${record.path}"`));
          const resolvedComponent = isESModule(resolved) ? resolved.default : resolved;
          record.components[name] = resolvedComponent;
          const options = resolvedComponent.__vccOpts || resolvedComponent;
          const guard = options[guardType];
          return guard && guardToPromiseFn(guard, to, from, record, name)();
        }));
      }
    }
  }
  return guards;
}
function isRouteComponent(component) {
  return typeof component === "object" || "displayName" in component || "props" in component || "__vccOpts" in component;
}
function useLink(props) {
  const router2 = inject(routerKey);
  const currentRoute = inject(routeLocationKey);
  const route = computed(() => router2.resolve(unref(props.to)));
  const activeRecordIndex = computed(() => {
    const { matched } = route.value;
    const { length } = matched;
    const routeMatched = matched[length - 1];
    const currentMatched = currentRoute.matched;
    if (!routeMatched || !currentMatched.length)
      return -1;
    const index = currentMatched.findIndex(isSameRouteRecord.bind(null, routeMatched));
    if (index > -1)
      return index;
    const parentRecordPath = getOriginalPath(matched[length - 2]);
    return (
      // we are dealing with nested routes
      length > 1 && // if the parent and matched route have the same path, this link is
      // referring to the empty child. Or we currently are on a different
      // child of the same parent
      getOriginalPath(routeMatched) === parentRecordPath && // avoid comparing the child with its parent
      currentMatched[currentMatched.length - 1].path !== parentRecordPath ? currentMatched.findIndex(isSameRouteRecord.bind(null, matched[length - 2])) : index
    );
  });
  const isActive = computed(() => activeRecordIndex.value > -1 && includesParams(currentRoute.params, route.value.params));
  const isExactActive = computed(() => activeRecordIndex.value > -1 && activeRecordIndex.value === currentRoute.matched.length - 1 && isSameRouteLocationParams(currentRoute.params, route.value.params));
  function navigate(e = {}) {
    if (guardEvent(e)) {
      return router2[unref(props.replace) ? "replace" : "push"](
        unref(props.to)
        // avoid uncaught errors are they are logged anyway
      ).catch(noop);
    }
    return Promise.resolve();
  }
  return {
    route,
    href: computed(() => route.value.href),
    isActive,
    isExactActive,
    navigate
  };
}
const RouterLinkImpl = /* @__PURE__ */ defineComponent({
  name: "RouterLink",
  compatConfig: { MODE: 3 },
  props: {
    to: {
      type: [String, Object],
      required: true
    },
    replace: Boolean,
    activeClass: String,
    // inactiveClass: String,
    exactActiveClass: String,
    custom: Boolean,
    ariaCurrentValue: {
      type: String,
      default: "page"
    }
  },
  useLink,
  setup(props, { slots }) {
    const link = reactive(useLink(props));
    const { options } = inject(routerKey);
    const elClass = computed(() => ({
      [getLinkClass(props.activeClass, options.linkActiveClass, "router-link-active")]: link.isActive,
      // [getLinkClass(
      //   props.inactiveClass,
      //   options.linkInactiveClass,
      //   'router-link-inactive'
      // )]: !link.isExactActive,
      [getLinkClass(props.exactActiveClass, options.linkExactActiveClass, "router-link-exact-active")]: link.isExactActive
    }));
    return () => {
      const children = slots.default && slots.default(link);
      return props.custom ? children : h("a", {
        "aria-current": link.isExactActive ? props.ariaCurrentValue : null,
        href: link.href,
        // this would override user added attrs but Vue will still add
        // the listener, so we end up triggering both
        onClick: link.navigate,
        class: elClass.value
      }, children);
    };
  }
});
const RouterLink = RouterLinkImpl;
function guardEvent(e) {
  if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey)
    return;
  if (e.defaultPrevented)
    return;
  if (e.button !== void 0 && e.button !== 0)
    return;
  if (e.currentTarget && e.currentTarget.getAttribute) {
    const target = e.currentTarget.getAttribute("target");
    if (/\b_blank\b/i.test(target))
      return;
  }
  if (e.preventDefault)
    e.preventDefault();
  return true;
}
function includesParams(outer, inner) {
  for (const key in inner) {
    const innerValue = inner[key];
    const outerValue = outer[key];
    if (typeof innerValue === "string") {
      if (innerValue !== outerValue)
        return false;
    } else {
      if (!isArray(outerValue) || outerValue.length !== innerValue.length || innerValue.some((value, i2) => value !== outerValue[i2]))
        return false;
    }
  }
  return true;
}
function getOriginalPath(record) {
  return record ? record.aliasOf ? record.aliasOf.path : record.path : "";
}
const getLinkClass = (propClass, globalClass, defaultClass) => propClass != null ? propClass : globalClass != null ? globalClass : defaultClass;
const RouterViewImpl = /* @__PURE__ */ defineComponent({
  name: "RouterView",
  // #674 we manually inherit them
  inheritAttrs: false,
  props: {
    name: {
      type: String,
      default: "default"
    },
    route: Object
  },
  // Better compat for @vue/compat users
  // https://github.com/vuejs/router/issues/1315
  compatConfig: { MODE: 3 },
  setup(props, { attrs, slots }) {
    const injectedRoute = inject(routerViewLocationKey);
    const routeToDisplay = computed(() => props.route || injectedRoute.value);
    const injectedDepth = inject(viewDepthKey, 0);
    const depth = computed(() => {
      let initialDepth = unref(injectedDepth);
      const { matched } = routeToDisplay.value;
      let matchedRoute;
      while ((matchedRoute = matched[initialDepth]) && !matchedRoute.components) {
        initialDepth++;
      }
      return initialDepth;
    });
    const matchedRouteRef = computed(() => routeToDisplay.value.matched[depth.value]);
    provide(viewDepthKey, computed(() => depth.value + 1));
    provide(matchedRouteKey, matchedRouteRef);
    provide(routerViewLocationKey, routeToDisplay);
    const viewRef = ref();
    watch(() => [viewRef.value, matchedRouteRef.value, props.name], ([instance, to, name], [oldInstance, from, oldName]) => {
      if (to) {
        to.instances[name] = instance;
        if (from && from !== to && instance && instance === oldInstance) {
          if (!to.leaveGuards.size) {
            to.leaveGuards = from.leaveGuards;
          }
          if (!to.updateGuards.size) {
            to.updateGuards = from.updateGuards;
          }
        }
      }
      if (instance && to && // if there is no instance but to and from are the same this might be
      // the first visit
      (!from || !isSameRouteRecord(to, from) || !oldInstance)) {
        (to.enterCallbacks[name] || []).forEach((callback) => callback(instance));
      }
    }, { flush: "post" });
    return () => {
      const route = routeToDisplay.value;
      const currentName = props.name;
      const matchedRoute = matchedRouteRef.value;
      const ViewComponent = matchedRoute && matchedRoute.components[currentName];
      if (!ViewComponent) {
        return normalizeSlot(slots.default, { Component: ViewComponent, route });
      }
      const routePropsOption = matchedRoute.props[currentName];
      const routeProps = routePropsOption ? routePropsOption === true ? route.params : typeof routePropsOption === "function" ? routePropsOption(route) : routePropsOption : null;
      const onVnodeUnmounted = (vnode) => {
        if (vnode.component.isUnmounted) {
          matchedRoute.instances[currentName] = null;
        }
      };
      const component = h(ViewComponent, assign({}, routeProps, attrs, {
        onVnodeUnmounted,
        ref: viewRef
      }));
      return (
        // pass the vnode to the slot as a prop.
        // h and <component :is="..."> both accept vnodes
        normalizeSlot(slots.default, { Component: component, route }) || component
      );
    };
  }
});
function normalizeSlot(slot, data) {
  if (!slot)
    return null;
  const slotContent = slot(data);
  return slotContent.length === 1 ? slotContent[0] : slotContent;
}
const RouterView = RouterViewImpl;
function createRouter(options) {
  const matcher = createRouterMatcher(options.routes, options);
  const parseQuery$1 = options.parseQuery || parseQuery;
  const stringifyQuery$1 = options.stringifyQuery || stringifyQuery;
  const routerHistory = options.history;
  const beforeGuards = useCallbacks();
  const beforeResolveGuards = useCallbacks();
  const afterGuards = useCallbacks();
  const currentRoute = shallowRef(START_LOCATION_NORMALIZED);
  let pendingLocation = START_LOCATION_NORMALIZED;
  if (isBrowser && options.scrollBehavior && "scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  const normalizeParams = applyToParams.bind(null, (paramValue) => "" + paramValue);
  const encodeParams = applyToParams.bind(null, encodeParam);
  const decodeParams = (
    // @ts-expect-error: intentionally avoid the type check
    applyToParams.bind(null, decode$1)
  );
  function addRoute(parentOrRoute, route) {
    let parent;
    let record;
    if (isRouteName(parentOrRoute)) {
      parent = matcher.getRecordMatcher(parentOrRoute);
      record = route;
    } else {
      record = parentOrRoute;
    }
    return matcher.addRoute(record, parent);
  }
  function removeRoute(name) {
    const recordMatcher = matcher.getRecordMatcher(name);
    if (recordMatcher) {
      matcher.removeRoute(recordMatcher);
    }
  }
  function getRoutes() {
    return matcher.getRoutes().map((routeMatcher) => routeMatcher.record);
  }
  function hasRoute(name) {
    return !!matcher.getRecordMatcher(name);
  }
  function resolve2(rawLocation, currentLocation) {
    currentLocation = assign({}, currentLocation || currentRoute.value);
    if (typeof rawLocation === "string") {
      const locationNormalized = parseURL(parseQuery$1, rawLocation, currentLocation.path);
      const matchedRoute2 = matcher.resolve({ path: locationNormalized.path }, currentLocation);
      const href2 = routerHistory.createHref(locationNormalized.fullPath);
      return assign(locationNormalized, matchedRoute2, {
        params: decodeParams(matchedRoute2.params),
        hash: decode$1(locationNormalized.hash),
        redirectedFrom: void 0,
        href: href2
      });
    }
    let matcherLocation;
    if ("path" in rawLocation) {
      matcherLocation = assign({}, rawLocation, {
        path: parseURL(parseQuery$1, rawLocation.path, currentLocation.path).path
      });
    } else {
      const targetParams = assign({}, rawLocation.params);
      for (const key in targetParams) {
        if (targetParams[key] == null) {
          delete targetParams[key];
        }
      }
      matcherLocation = assign({}, rawLocation, {
        params: encodeParams(targetParams)
      });
      currentLocation.params = encodeParams(currentLocation.params);
    }
    const matchedRoute = matcher.resolve(matcherLocation, currentLocation);
    const hash2 = rawLocation.hash || "";
    matchedRoute.params = normalizeParams(decodeParams(matchedRoute.params));
    const fullPath = stringifyURL(stringifyQuery$1, assign({}, rawLocation, {
      hash: encodeHash(hash2),
      path: matchedRoute.path
    }));
    const href = routerHistory.createHref(fullPath);
    return assign({
      fullPath,
      // keep the hash encoded so fullPath is effectively path + encodedQuery +
      // hash
      hash: hash2,
      query: (
        // if the user is using a custom query lib like qs, we might have
        // nested objects, so we keep the query as is, meaning it can contain
        // numbers at `$route.query`, but at the point, the user will have to
        // use their own type anyway.
        // https://github.com/vuejs/router/issues/328#issuecomment-649481567
        stringifyQuery$1 === stringifyQuery ? normalizeQuery(rawLocation.query) : rawLocation.query || {}
      )
    }, matchedRoute, {
      redirectedFrom: void 0,
      href
    });
  }
  function locationAsObject(to) {
    return typeof to === "string" ? parseURL(parseQuery$1, to, currentRoute.value.path) : assign({}, to);
  }
  function checkCanceledNavigation(to, from) {
    if (pendingLocation !== to) {
      return createRouterError(8, {
        from,
        to
      });
    }
  }
  function push(to) {
    return pushWithRedirect(to);
  }
  function replace(to) {
    return push(assign(locationAsObject(to), { replace: true }));
  }
  function handleRedirectRecord(to) {
    const lastMatched = to.matched[to.matched.length - 1];
    if (lastMatched && lastMatched.redirect) {
      const { redirect } = lastMatched;
      let newTargetLocation = typeof redirect === "function" ? redirect(to) : redirect;
      if (typeof newTargetLocation === "string") {
        newTargetLocation = newTargetLocation.includes("?") || newTargetLocation.includes("#") ? newTargetLocation = locationAsObject(newTargetLocation) : (
          // force empty params
          { path: newTargetLocation }
        );
        newTargetLocation.params = {};
      }
      return assign({
        query: to.query,
        hash: to.hash,
        // avoid transferring params if the redirect has a path
        params: "path" in newTargetLocation ? {} : to.params
      }, newTargetLocation);
    }
  }
  function pushWithRedirect(to, redirectedFrom) {
    const targetLocation = pendingLocation = resolve2(to);
    const from = currentRoute.value;
    const data = to.state;
    const force = to.force;
    const replace2 = to.replace === true;
    const shouldRedirect = handleRedirectRecord(targetLocation);
    if (shouldRedirect)
      return pushWithRedirect(
        assign(locationAsObject(shouldRedirect), {
          state: typeof shouldRedirect === "object" ? assign({}, data, shouldRedirect.state) : data,
          force,
          replace: replace2
        }),
        // keep original redirectedFrom if it exists
        redirectedFrom || targetLocation
      );
    const toLocation = targetLocation;
    toLocation.redirectedFrom = redirectedFrom;
    let failure;
    if (!force && isSameRouteLocation(stringifyQuery$1, from, targetLocation)) {
      failure = createRouterError(16, { to: toLocation, from });
      handleScroll(
        from,
        from,
        // this is a push, the only way for it to be triggered from a
        // history.listen is with a redirect, which makes it become a push
        true,
        // This cannot be the first navigation because the initial location
        // cannot be manually navigated to
        false
      );
    }
    return (failure ? Promise.resolve(failure) : navigate(toLocation, from)).catch((error) => isNavigationFailure(error) ? (
      // navigation redirects still mark the router as ready
      isNavigationFailure(
        error,
        2
        /* ErrorTypes.NAVIGATION_GUARD_REDIRECT */
      ) ? error : markAsReady(error)
    ) : (
      // reject any unknown error
      triggerError(error, toLocation, from)
    )).then((failure2) => {
      if (failure2) {
        if (isNavigationFailure(
          failure2,
          2
          /* ErrorTypes.NAVIGATION_GUARD_REDIRECT */
        )) {
          return pushWithRedirect(
            // keep options
            assign({
              // preserve an existing replacement but allow the redirect to override it
              replace: replace2
            }, locationAsObject(failure2.to), {
              state: typeof failure2.to === "object" ? assign({}, data, failure2.to.state) : data,
              force
            }),
            // preserve the original redirectedFrom if any
            redirectedFrom || toLocation
          );
        }
      } else {
        failure2 = finalizeNavigation(toLocation, from, true, replace2, data);
      }
      triggerAfterEach(toLocation, from, failure2);
      return failure2;
    });
  }
  function checkCanceledNavigationAndReject(to, from) {
    const error = checkCanceledNavigation(to, from);
    return error ? Promise.reject(error) : Promise.resolve();
  }
  function runWithContext(fn) {
    const app2 = installedApps.values().next().value;
    return app2 && typeof app2.runWithContext === "function" ? app2.runWithContext(fn) : fn();
  }
  function navigate(to, from) {
    let guards;
    const [leavingRecords, updatingRecords, enteringRecords] = extractChangingRecords(to, from);
    guards = extractComponentsGuards(leavingRecords.reverse(), "beforeRouteLeave", to, from);
    for (const record of leavingRecords) {
      record.leaveGuards.forEach((guard) => {
        guards.push(guardToPromiseFn(guard, to, from));
      });
    }
    const canceledNavigationCheck = checkCanceledNavigationAndReject.bind(null, to, from);
    guards.push(canceledNavigationCheck);
    return runGuardQueue(guards).then(() => {
      guards = [];
      for (const guard of beforeGuards.list()) {
        guards.push(guardToPromiseFn(guard, to, from));
      }
      guards.push(canceledNavigationCheck);
      return runGuardQueue(guards);
    }).then(() => {
      guards = extractComponentsGuards(updatingRecords, "beforeRouteUpdate", to, from);
      for (const record of updatingRecords) {
        record.updateGuards.forEach((guard) => {
          guards.push(guardToPromiseFn(guard, to, from));
        });
      }
      guards.push(canceledNavigationCheck);
      return runGuardQueue(guards);
    }).then(() => {
      guards = [];
      for (const record of enteringRecords) {
        if (record.beforeEnter) {
          if (isArray(record.beforeEnter)) {
            for (const beforeEnter of record.beforeEnter)
              guards.push(guardToPromiseFn(beforeEnter, to, from));
          } else {
            guards.push(guardToPromiseFn(record.beforeEnter, to, from));
          }
        }
      }
      guards.push(canceledNavigationCheck);
      return runGuardQueue(guards);
    }).then(() => {
      to.matched.forEach((record) => record.enterCallbacks = {});
      guards = extractComponentsGuards(enteringRecords, "beforeRouteEnter", to, from);
      guards.push(canceledNavigationCheck);
      return runGuardQueue(guards);
    }).then(() => {
      guards = [];
      for (const guard of beforeResolveGuards.list()) {
        guards.push(guardToPromiseFn(guard, to, from));
      }
      guards.push(canceledNavigationCheck);
      return runGuardQueue(guards);
    }).catch((err) => isNavigationFailure(
      err,
      8
      /* ErrorTypes.NAVIGATION_CANCELLED */
    ) ? err : Promise.reject(err));
  }
  function triggerAfterEach(to, from, failure) {
    afterGuards.list().forEach((guard) => runWithContext(() => guard(to, from, failure)));
  }
  function finalizeNavigation(toLocation, from, isPush, replace2, data) {
    const error = checkCanceledNavigation(toLocation, from);
    if (error)
      return error;
    const isFirstNavigation = from === START_LOCATION_NORMALIZED;
    const state = !isBrowser ? {} : history.state;
    if (isPush) {
      if (replace2 || isFirstNavigation)
        routerHistory.replace(toLocation.fullPath, assign({
          scroll: isFirstNavigation && state && state.scroll
        }, data));
      else
        routerHistory.push(toLocation.fullPath, data);
    }
    currentRoute.value = toLocation;
    handleScroll(toLocation, from, isPush, isFirstNavigation);
    markAsReady();
  }
  let removeHistoryListener;
  function setupListeners() {
    if (removeHistoryListener)
      return;
    removeHistoryListener = routerHistory.listen((to, _from, info) => {
      if (!router2.listening)
        return;
      const toLocation = resolve2(to);
      const shouldRedirect = handleRedirectRecord(toLocation);
      if (shouldRedirect) {
        pushWithRedirect(assign(shouldRedirect, { replace: true }), toLocation).catch(noop);
        return;
      }
      pendingLocation = toLocation;
      const from = currentRoute.value;
      if (isBrowser) {
        saveScrollPosition(getScrollKey(from.fullPath, info.delta), computeScrollPosition());
      }
      navigate(toLocation, from).catch((error) => {
        if (isNavigationFailure(
          error,
          4 | 8
          /* ErrorTypes.NAVIGATION_CANCELLED */
        )) {
          return error;
        }
        if (isNavigationFailure(
          error,
          2
          /* ErrorTypes.NAVIGATION_GUARD_REDIRECT */
        )) {
          pushWithRedirect(
            error.to,
            toLocation
            // avoid an uncaught rejection, let push call triggerError
          ).then((failure) => {
            if (isNavigationFailure(
              failure,
              4 | 16
              /* ErrorTypes.NAVIGATION_DUPLICATED */
            ) && !info.delta && info.type === NavigationType.pop) {
              routerHistory.go(-1, false);
            }
          }).catch(noop);
          return Promise.reject();
        }
        if (info.delta) {
          routerHistory.go(-info.delta, false);
        }
        return triggerError(error, toLocation, from);
      }).then((failure) => {
        failure = failure || finalizeNavigation(
          // after navigation, all matched components are resolved
          toLocation,
          from,
          false
        );
        if (failure) {
          if (info.delta && // a new navigation has been triggered, so we do not want to revert, that will change the current history
          // entry while a different route is displayed
          !isNavigationFailure(
            failure,
            8
            /* ErrorTypes.NAVIGATION_CANCELLED */
          )) {
            routerHistory.go(-info.delta, false);
          } else if (info.type === NavigationType.pop && isNavigationFailure(
            failure,
            4 | 16
            /* ErrorTypes.NAVIGATION_DUPLICATED */
          )) {
            routerHistory.go(-1, false);
          }
        }
        triggerAfterEach(toLocation, from, failure);
      }).catch(noop);
    });
  }
  let readyHandlers = useCallbacks();
  let errorListeners = useCallbacks();
  let ready;
  function triggerError(error, to, from) {
    markAsReady(error);
    const list = errorListeners.list();
    if (list.length) {
      list.forEach((handler) => handler(error, to, from));
    } else {
      console.error(error);
    }
    return Promise.reject(error);
  }
  function isReady() {
    if (ready && currentRoute.value !== START_LOCATION_NORMALIZED)
      return Promise.resolve();
    return new Promise((resolve3, reject) => {
      readyHandlers.add([resolve3, reject]);
    });
  }
  function markAsReady(err) {
    if (!ready) {
      ready = !err;
      setupListeners();
      readyHandlers.list().forEach(([resolve3, reject]) => err ? reject(err) : resolve3());
      readyHandlers.reset();
    }
    return err;
  }
  function handleScroll(to, from, isPush, isFirstNavigation) {
    const { scrollBehavior } = options;
    if (!isBrowser || !scrollBehavior)
      return Promise.resolve();
    const scrollPosition = !isPush && getSavedScrollPosition(getScrollKey(to.fullPath, 0)) || (isFirstNavigation || !isPush) && history.state && history.state.scroll || null;
    return nextTick().then(() => scrollBehavior(to, from, scrollPosition)).then((position) => position && scrollToPosition(position)).catch((err) => triggerError(err, to, from));
  }
  const go = (delta) => routerHistory.go(delta);
  let started;
  const installedApps = /* @__PURE__ */ new Set();
  const router2 = {
    currentRoute,
    listening: true,
    addRoute,
    removeRoute,
    hasRoute,
    getRoutes,
    resolve: resolve2,
    options,
    push,
    replace,
    go,
    back: () => go(-1),
    forward: () => go(1),
    beforeEach: beforeGuards.add,
    beforeResolve: beforeResolveGuards.add,
    afterEach: afterGuards.add,
    onError: errorListeners.add,
    isReady,
    install(app2) {
      const router3 = this;
      app2.component("RouterLink", RouterLink);
      app2.component("RouterView", RouterView);
      app2.config.globalProperties.$router = router3;
      Object.defineProperty(app2.config.globalProperties, "$route", {
        enumerable: true,
        get: () => unref(currentRoute)
      });
      if (isBrowser && // used for the initial navigation client side to avoid pushing
      // multiple times when the router is used in multiple apps
      !started && currentRoute.value === START_LOCATION_NORMALIZED) {
        started = true;
        push(routerHistory.location).catch((err) => {
        });
      }
      const reactiveRoute = {};
      for (const key in START_LOCATION_NORMALIZED) {
        Object.defineProperty(reactiveRoute, key, {
          get: () => currentRoute.value[key],
          enumerable: true
        });
      }
      app2.provide(routerKey, router3);
      app2.provide(routeLocationKey, shallowReactive(reactiveRoute));
      app2.provide(routerViewLocationKey, currentRoute);
      const unmountApp = app2.unmount;
      installedApps.add(app2);
      app2.unmount = function() {
        installedApps.delete(app2);
        if (installedApps.size < 1) {
          pendingLocation = START_LOCATION_NORMALIZED;
          removeHistoryListener && removeHistoryListener();
          removeHistoryListener = null;
          currentRoute.value = START_LOCATION_NORMALIZED;
          started = false;
          ready = false;
        }
        unmountApp();
      };
    }
  };
  function runGuardQueue(guards) {
    return guards.reduce((promise, guard) => promise.then(() => runWithContext(guard)), Promise.resolve());
  }
  return router2;
}
function extractChangingRecords(to, from) {
  const leavingRecords = [];
  const updatingRecords = [];
  const enteringRecords = [];
  const len = Math.max(from.matched.length, to.matched.length);
  for (let i2 = 0; i2 < len; i2++) {
    const recordFrom = from.matched[i2];
    if (recordFrom) {
      if (to.matched.find((record) => isSameRouteRecord(record, recordFrom)))
        updatingRecords.push(recordFrom);
      else
        leavingRecords.push(recordFrom);
    }
    const recordTo = to.matched[i2];
    if (recordTo) {
      if (!from.matched.find((record) => isSameRouteRecord(record, recordTo))) {
        enteringRecords.push(recordTo);
      }
    }
  }
  return [leavingRecords, updatingRecords, enteringRecords];
}
function useRouter() {
  return inject(routerKey);
}
function useRoute() {
  return inject(routeLocationKey);
}
function number$2(n) {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error(`Wrong positive integer: ${n}`);
}
function bytes$3(b, ...lengths) {
  if (!(b instanceof Uint8Array))
    throw new Error("Expected Uint8Array");
  if (lengths.length > 0 && !lengths.includes(b.length))
    throw new Error(`Expected Uint8Array of length ${lengths}, not of length=${b.length}`);
}
function hash$1(hash2) {
  if (typeof hash2 !== "function" || typeof hash2.create !== "function")
    throw new Error("Hash should be wrapped by utils.wrapConstructor");
  number$2(hash2.outputLen);
  number$2(hash2.blockLen);
}
function exists$2(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function output$2(out, instance) {
  bytes$3(out);
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error(`digestInto() expects output buffer of length at least ${min}`);
  }
}
const crypto$1 = typeof globalThis === "object" && "crypto" in globalThis ? globalThis.crypto : void 0;
/*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
const u8a$2 = (a) => a instanceof Uint8Array;
const createView$2 = (arr) => new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
const rotr$2 = (word, shift) => word << 32 - shift | word >>> shift;
const isLE$2 = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
if (!isLE$2)
  throw new Error("Non little-endian hardware is not supported");
function utf8ToBytes$3(str) {
  if (typeof str !== "string")
    throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
  return new Uint8Array(new TextEncoder().encode(str));
}
function toBytes$2(data) {
  if (typeof data === "string")
    data = utf8ToBytes$3(data);
  if (!u8a$2(data))
    throw new Error(`expected Uint8Array, got ${typeof data}`);
  return data;
}
function concatBytes$2(...arrays) {
  const r = new Uint8Array(arrays.reduce((sum, a) => sum + a.length, 0));
  let pad = 0;
  arrays.forEach((a) => {
    if (!u8a$2(a))
      throw new Error("Uint8Array expected");
    r.set(a, pad);
    pad += a.length;
  });
  return r;
}
let Hash$2 = class Hash {
  // Safe version that clones internal state
  clone() {
    return this._cloneInto();
  }
};
function wrapConstructor$2(hashCons) {
  const hashC = (msg) => hashCons().update(toBytes$2(msg)).digest();
  const tmp = hashCons();
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = () => hashCons();
  return hashC;
}
function randomBytes$1(bytesLength = 32) {
  if (crypto$1 && typeof crypto$1.getRandomValues === "function") {
    return crypto$1.getRandomValues(new Uint8Array(bytesLength));
  }
  throw new Error("crypto.getRandomValues must be defined");
}
function setBigUint64$2(view, byteOffset, value, isLE2) {
  if (typeof view.setBigUint64 === "function")
    return view.setBigUint64(byteOffset, value, isLE2);
  const _32n = BigInt(32);
  const _u32_max = BigInt(4294967295);
  const wh = Number(value >> _32n & _u32_max);
  const wl = Number(value & _u32_max);
  const h2 = isLE2 ? 4 : 0;
  const l = isLE2 ? 0 : 4;
  view.setUint32(byteOffset + h2, wh, isLE2);
  view.setUint32(byteOffset + l, wl, isLE2);
}
let SHA2$1 = class SHA2 extends Hash$2 {
  constructor(blockLen, outputLen, padOffset, isLE2) {
    super();
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE2;
    this.finished = false;
    this.length = 0;
    this.pos = 0;
    this.destroyed = false;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView$2(this.buffer);
  }
  update(data) {
    exists$2(this);
    const { view, buffer, blockLen } = this;
    data = toBytes$2(data);
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView$2(data);
        for (; blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
      }
    }
    this.length += data.length;
    this.roundClean();
    return this;
  }
  digestInto(out) {
    exists$2(this);
    output$2(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE: isLE2 } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    this.buffer.subarray(pos).fill(0);
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      pos = 0;
    }
    for (let i2 = pos; i2 < blockLen; i2++)
      buffer[i2] = 0;
    setBigUint64$2(view, blockLen - 8, BigInt(this.length * 8), isLE2);
    this.process(view, 0);
    const oview = createView$2(out);
    const len = this.outputLen;
    if (len % 4)
      throw new Error("_sha2: outputLen should be aligned to 32bit");
    const outLen = len / 4;
    const state = this.get();
    if (outLen > state.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let i2 = 0; i2 < outLen; i2++)
      oview.setUint32(4 * i2, state[i2], isLE2);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneInto(to) {
    to || (to = new this.constructor());
    to.set(...this.get());
    const { blockLen, buffer, length, finished, destroyed, pos } = this;
    to.length = length;
    to.pos = pos;
    to.finished = finished;
    to.destroyed = destroyed;
    if (length % blockLen)
      to.buffer.set(buffer);
    return to;
  }
};
const Chi$2 = (a, b, c) => a & b ^ ~a & c;
const Maj$2 = (a, b, c) => a & b ^ a & c ^ b & c;
const SHA256_K$2 = /* @__PURE__ */ new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
const IV$1 = /* @__PURE__ */ new Uint32Array([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);
const SHA256_W$2 = /* @__PURE__ */ new Uint32Array(64);
let SHA256$2 = class SHA256 extends SHA2$1 {
  constructor() {
    super(64, 32, 8, false);
    this.A = IV$1[0] | 0;
    this.B = IV$1[1] | 0;
    this.C = IV$1[2] | 0;
    this.D = IV$1[3] | 0;
    this.E = IV$1[4] | 0;
    this.F = IV$1[5] | 0;
    this.G = IV$1[6] | 0;
    this.H = IV$1[7] | 0;
  }
  get() {
    const { A, B, C, D, E, F, G, H } = this;
    return [A, B, C, D, E, F, G, H];
  }
  // prettier-ignore
  set(A, B, C, D, E, F, G, H) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D | 0;
    this.E = E | 0;
    this.F = F | 0;
    this.G = G | 0;
    this.H = H | 0;
  }
  process(view, offset) {
    for (let i2 = 0; i2 < 16; i2++, offset += 4)
      SHA256_W$2[i2] = view.getUint32(offset, false);
    for (let i2 = 16; i2 < 64; i2++) {
      const W15 = SHA256_W$2[i2 - 15];
      const W2 = SHA256_W$2[i2 - 2];
      const s0 = rotr$2(W15, 7) ^ rotr$2(W15, 18) ^ W15 >>> 3;
      const s1 = rotr$2(W2, 17) ^ rotr$2(W2, 19) ^ W2 >>> 10;
      SHA256_W$2[i2] = s1 + SHA256_W$2[i2 - 7] + s0 + SHA256_W$2[i2 - 16] | 0;
    }
    let { A, B, C, D, E, F, G, H } = this;
    for (let i2 = 0; i2 < 64; i2++) {
      const sigma1 = rotr$2(E, 6) ^ rotr$2(E, 11) ^ rotr$2(E, 25);
      const T1 = H + sigma1 + Chi$2(E, F, G) + SHA256_K$2[i2] + SHA256_W$2[i2] | 0;
      const sigma0 = rotr$2(A, 2) ^ rotr$2(A, 13) ^ rotr$2(A, 22);
      const T2 = sigma0 + Maj$2(A, B, C) | 0;
      H = G;
      G = F;
      F = E;
      E = D + T1 | 0;
      D = C;
      C = B;
      B = A;
      A = T1 + T2 | 0;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D = D + this.D | 0;
    E = E + this.E | 0;
    F = F + this.F | 0;
    G = G + this.G | 0;
    H = H + this.H | 0;
    this.set(A, B, C, D, E, F, G, H);
  }
  roundClean() {
    SHA256_W$2.fill(0);
  }
  destroy() {
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    this.buffer.fill(0);
  }
};
const sha256$2 = /* @__PURE__ */ wrapConstructor$2(() => new SHA256$2());
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
const _0n$4 = BigInt(0);
const _1n$4 = BigInt(1);
const _2n$2 = BigInt(2);
const u8a$1 = (a) => a instanceof Uint8Array;
const hexes$2 = /* @__PURE__ */ Array.from({ length: 256 }, (_, i2) => i2.toString(16).padStart(2, "0"));
function bytesToHex$2(bytes2) {
  if (!u8a$1(bytes2))
    throw new Error("Uint8Array expected");
  let hex2 = "";
  for (let i2 = 0; i2 < bytes2.length; i2++) {
    hex2 += hexes$2[bytes2[i2]];
  }
  return hex2;
}
function numberToHexUnpadded(num) {
  const hex2 = num.toString(16);
  return hex2.length & 1 ? `0${hex2}` : hex2;
}
function hexToNumber(hex2) {
  if (typeof hex2 !== "string")
    throw new Error("hex string expected, got " + typeof hex2);
  return BigInt(hex2 === "" ? "0" : `0x${hex2}`);
}
function hexToBytes$2(hex2) {
  if (typeof hex2 !== "string")
    throw new Error("hex string expected, got " + typeof hex2);
  const len = hex2.length;
  if (len % 2)
    throw new Error("padded hex string expected, got unpadded hex of length " + len);
  const array = new Uint8Array(len / 2);
  for (let i2 = 0; i2 < array.length; i2++) {
    const j = i2 * 2;
    const hexByte = hex2.slice(j, j + 2);
    const byte = Number.parseInt(hexByte, 16);
    if (Number.isNaN(byte) || byte < 0)
      throw new Error("Invalid byte sequence");
    array[i2] = byte;
  }
  return array;
}
function bytesToNumberBE(bytes2) {
  return hexToNumber(bytesToHex$2(bytes2));
}
function bytesToNumberLE(bytes2) {
  if (!u8a$1(bytes2))
    throw new Error("Uint8Array expected");
  return hexToNumber(bytesToHex$2(Uint8Array.from(bytes2).reverse()));
}
function numberToBytesBE(n, len) {
  return hexToBytes$2(n.toString(16).padStart(len * 2, "0"));
}
function numberToBytesLE(n, len) {
  return numberToBytesBE(n, len).reverse();
}
function numberToVarBytesBE(n) {
  return hexToBytes$2(numberToHexUnpadded(n));
}
function ensureBytes(title, hex2, expectedLength) {
  let res;
  if (typeof hex2 === "string") {
    try {
      res = hexToBytes$2(hex2);
    } catch (e) {
      throw new Error(`${title} must be valid hex string, got "${hex2}". Cause: ${e}`);
    }
  } else if (u8a$1(hex2)) {
    res = Uint8Array.from(hex2);
  } else {
    throw new Error(`${title} must be hex string or Uint8Array`);
  }
  const len = res.length;
  if (typeof expectedLength === "number" && len !== expectedLength)
    throw new Error(`${title} expected ${expectedLength} bytes, got ${len}`);
  return res;
}
function concatBytes$1(...arrays) {
  const r = new Uint8Array(arrays.reduce((sum, a) => sum + a.length, 0));
  let pad = 0;
  arrays.forEach((a) => {
    if (!u8a$1(a))
      throw new Error("Uint8Array expected");
    r.set(a, pad);
    pad += a.length;
  });
  return r;
}
function equalBytes$1(b1, b2) {
  if (b1.length !== b2.length)
    return false;
  for (let i2 = 0; i2 < b1.length; i2++)
    if (b1[i2] !== b2[i2])
      return false;
  return true;
}
function utf8ToBytes$2(str) {
  if (typeof str !== "string")
    throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
  return new Uint8Array(new TextEncoder().encode(str));
}
function bitLen(n) {
  let len;
  for (len = 0; n > _0n$4; n >>= _1n$4, len += 1)
    ;
  return len;
}
function bitGet(n, pos) {
  return n >> BigInt(pos) & _1n$4;
}
const bitSet = (n, pos, value) => {
  return n | (value ? _1n$4 : _0n$4) << BigInt(pos);
};
const bitMask = (n) => (_2n$2 << BigInt(n - 1)) - _1n$4;
const u8n = (data) => new Uint8Array(data);
const u8fr = (arr) => Uint8Array.from(arr);
function createHmacDrbg(hashLen, qByteLen, hmacFn) {
  if (typeof hashLen !== "number" || hashLen < 2)
    throw new Error("hashLen must be a number");
  if (typeof qByteLen !== "number" || qByteLen < 2)
    throw new Error("qByteLen must be a number");
  if (typeof hmacFn !== "function")
    throw new Error("hmacFn must be a function");
  let v = u8n(hashLen);
  let k = u8n(hashLen);
  let i2 = 0;
  const reset = () => {
    v.fill(1);
    k.fill(0);
    i2 = 0;
  };
  const h2 = (...b) => hmacFn(k, v, ...b);
  const reseed = (seed = u8n()) => {
    k = h2(u8fr([0]), seed);
    v = h2();
    if (seed.length === 0)
      return;
    k = h2(u8fr([1]), seed);
    v = h2();
  };
  const gen = () => {
    if (i2++ >= 1e3)
      throw new Error("drbg: tried 1000 values");
    let len = 0;
    const out = [];
    while (len < qByteLen) {
      v = h2();
      const sl = v.slice();
      out.push(sl);
      len += v.length;
    }
    return concatBytes$1(...out);
  };
  const genUntil = (seed, pred) => {
    reset();
    reseed(seed);
    let res = void 0;
    while (!(res = pred(gen())))
      reseed();
    reset();
    return res;
  };
  return genUntil;
}
const validatorFns = {
  bigint: (val) => typeof val === "bigint",
  function: (val) => typeof val === "function",
  boolean: (val) => typeof val === "boolean",
  string: (val) => typeof val === "string",
  stringOrUint8Array: (val) => typeof val === "string" || val instanceof Uint8Array,
  isSafeInteger: (val) => Number.isSafeInteger(val),
  array: (val) => Array.isArray(val),
  field: (val, object) => object.Fp.isValid(val),
  hash: (val) => typeof val === "function" && Number.isSafeInteger(val.outputLen)
};
function validateObject(object, validators, optValidators = {}) {
  const checkField = (fieldName, type, isOptional) => {
    const checkVal = validatorFns[type];
    if (typeof checkVal !== "function")
      throw new Error(`Invalid validator "${type}", expected function`);
    const val = object[fieldName];
    if (isOptional && val === void 0)
      return;
    if (!checkVal(val, object)) {
      throw new Error(`Invalid param ${String(fieldName)}=${val} (${typeof val}), expected ${type}`);
    }
  };
  for (const [fieldName, type] of Object.entries(validators))
    checkField(fieldName, type, false);
  for (const [fieldName, type] of Object.entries(optValidators))
    checkField(fieldName, type, true);
  return object;
}
const ut = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  bitGet,
  bitLen,
  bitMask,
  bitSet,
  bytesToHex: bytesToHex$2,
  bytesToNumberBE,
  bytesToNumberLE,
  concatBytes: concatBytes$1,
  createHmacDrbg,
  ensureBytes,
  equalBytes: equalBytes$1,
  hexToBytes: hexToBytes$2,
  hexToNumber,
  numberToBytesBE,
  numberToBytesLE,
  numberToHexUnpadded,
  numberToVarBytesBE,
  utf8ToBytes: utf8ToBytes$2,
  validateObject
}, Symbol.toStringTag, { value: "Module" }));
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
const _0n$3 = BigInt(0), _1n$3 = BigInt(1), _2n$1 = BigInt(2), _3n$1 = BigInt(3);
const _4n = BigInt(4), _5n = BigInt(5), _8n = BigInt(8);
BigInt(9);
BigInt(16);
function mod(a, b) {
  const result = a % b;
  return result >= _0n$3 ? result : b + result;
}
function pow(num, power, modulo) {
  if (modulo <= _0n$3 || power < _0n$3)
    throw new Error("Expected power/modulo > 0");
  if (modulo === _1n$3)
    return _0n$3;
  let res = _1n$3;
  while (power > _0n$3) {
    if (power & _1n$3)
      res = res * num % modulo;
    num = num * num % modulo;
    power >>= _1n$3;
  }
  return res;
}
function pow2(x, power, modulo) {
  let res = x;
  while (power-- > _0n$3) {
    res *= res;
    res %= modulo;
  }
  return res;
}
function invert(number2, modulo) {
  if (number2 === _0n$3 || modulo <= _0n$3) {
    throw new Error(`invert: expected positive integers, got n=${number2} mod=${modulo}`);
  }
  let a = mod(number2, modulo);
  let b = modulo;
  let x = _0n$3, u2 = _1n$3;
  while (a !== _0n$3) {
    const q = b / a;
    const r = b % a;
    const m = x - u2 * q;
    b = a, a = r, x = u2, u2 = m;
  }
  const gcd2 = b;
  if (gcd2 !== _1n$3)
    throw new Error("invert: does not exist");
  return mod(x, modulo);
}
function tonelliShanks(P) {
  const legendreC = (P - _1n$3) / _2n$1;
  let Q, S, Z;
  for (Q = P - _1n$3, S = 0; Q % _2n$1 === _0n$3; Q /= _2n$1, S++)
    ;
  for (Z = _2n$1; Z < P && pow(Z, legendreC, P) !== P - _1n$3; Z++)
    ;
  if (S === 1) {
    const p1div4 = (P + _1n$3) / _4n;
    return function tonelliFast(Fp2, n) {
      const root = Fp2.pow(n, p1div4);
      if (!Fp2.eql(Fp2.sqr(root), n))
        throw new Error("Cannot find square root");
      return root;
    };
  }
  const Q1div2 = (Q + _1n$3) / _2n$1;
  return function tonelliSlow(Fp2, n) {
    if (Fp2.pow(n, legendreC) === Fp2.neg(Fp2.ONE))
      throw new Error("Cannot find square root");
    let r = S;
    let g = Fp2.pow(Fp2.mul(Fp2.ONE, Z), Q);
    let x = Fp2.pow(n, Q1div2);
    let b = Fp2.pow(n, Q);
    while (!Fp2.eql(b, Fp2.ONE)) {
      if (Fp2.eql(b, Fp2.ZERO))
        return Fp2.ZERO;
      let m = 1;
      for (let t2 = Fp2.sqr(b); m < r; m++) {
        if (Fp2.eql(t2, Fp2.ONE))
          break;
        t2 = Fp2.sqr(t2);
      }
      const ge2 = Fp2.pow(g, _1n$3 << BigInt(r - m - 1));
      g = Fp2.sqr(ge2);
      x = Fp2.mul(x, ge2);
      b = Fp2.mul(b, g);
      r = m;
    }
    return x;
  };
}
function FpSqrt(P) {
  if (P % _4n === _3n$1) {
    const p1div4 = (P + _1n$3) / _4n;
    return function sqrt3mod4(Fp2, n) {
      const root = Fp2.pow(n, p1div4);
      if (!Fp2.eql(Fp2.sqr(root), n))
        throw new Error("Cannot find square root");
      return root;
    };
  }
  if (P % _8n === _5n) {
    const c1 = (P - _5n) / _8n;
    return function sqrt5mod8(Fp2, n) {
      const n2 = Fp2.mul(n, _2n$1);
      const v = Fp2.pow(n2, c1);
      const nv = Fp2.mul(n, v);
      const i2 = Fp2.mul(Fp2.mul(nv, _2n$1), v);
      const root = Fp2.mul(nv, Fp2.sub(i2, Fp2.ONE));
      if (!Fp2.eql(Fp2.sqr(root), n))
        throw new Error("Cannot find square root");
      return root;
    };
  }
  return tonelliShanks(P);
}
const FIELD_FIELDS = [
  "create",
  "isValid",
  "is0",
  "neg",
  "inv",
  "sqrt",
  "sqr",
  "eql",
  "add",
  "sub",
  "mul",
  "pow",
  "div",
  "addN",
  "subN",
  "mulN",
  "sqrN"
];
function validateField(field) {
  const initial = {
    ORDER: "bigint",
    MASK: "bigint",
    BYTES: "isSafeInteger",
    BITS: "isSafeInteger"
  };
  const opts = FIELD_FIELDS.reduce((map, val) => {
    map[val] = "function";
    return map;
  }, initial);
  return validateObject(field, opts);
}
function FpPow(f, num, power) {
  if (power < _0n$3)
    throw new Error("Expected power > 0");
  if (power === _0n$3)
    return f.ONE;
  if (power === _1n$3)
    return num;
  let p2 = f.ONE;
  let d = num;
  while (power > _0n$3) {
    if (power & _1n$3)
      p2 = f.mul(p2, d);
    d = f.sqr(d);
    power >>= _1n$3;
  }
  return p2;
}
function FpInvertBatch(f, nums) {
  const tmp = new Array(nums.length);
  const lastMultiplied = nums.reduce((acc, num, i2) => {
    if (f.is0(num))
      return acc;
    tmp[i2] = acc;
    return f.mul(acc, num);
  }, f.ONE);
  const inverted = f.inv(lastMultiplied);
  nums.reduceRight((acc, num, i2) => {
    if (f.is0(num))
      return acc;
    tmp[i2] = f.mul(acc, tmp[i2]);
    return f.mul(acc, num);
  }, inverted);
  return tmp;
}
function nLength(n, nBitLength) {
  const _nBitLength = nBitLength !== void 0 ? nBitLength : n.toString(2).length;
  const nByteLength = Math.ceil(_nBitLength / 8);
  return { nBitLength: _nBitLength, nByteLength };
}
function Field(ORDER, bitLen2, isLE2 = false, redef = {}) {
  if (ORDER <= _0n$3)
    throw new Error(`Expected Field ORDER > 0, got ${ORDER}`);
  const { nBitLength: BITS, nByteLength: BYTES } = nLength(ORDER, bitLen2);
  if (BYTES > 2048)
    throw new Error("Field lengths over 2048 bytes are not supported");
  const sqrtP = FpSqrt(ORDER);
  const f = Object.freeze({
    ORDER,
    BITS,
    BYTES,
    MASK: bitMask(BITS),
    ZERO: _0n$3,
    ONE: _1n$3,
    create: (num) => mod(num, ORDER),
    isValid: (num) => {
      if (typeof num !== "bigint")
        throw new Error(`Invalid field element: expected bigint, got ${typeof num}`);
      return _0n$3 <= num && num < ORDER;
    },
    is0: (num) => num === _0n$3,
    isOdd: (num) => (num & _1n$3) === _1n$3,
    neg: (num) => mod(-num, ORDER),
    eql: (lhs, rhs) => lhs === rhs,
    sqr: (num) => mod(num * num, ORDER),
    add: (lhs, rhs) => mod(lhs + rhs, ORDER),
    sub: (lhs, rhs) => mod(lhs - rhs, ORDER),
    mul: (lhs, rhs) => mod(lhs * rhs, ORDER),
    pow: (num, power) => FpPow(f, num, power),
    div: (lhs, rhs) => mod(lhs * invert(rhs, ORDER), ORDER),
    // Same as above, but doesn't normalize
    sqrN: (num) => num * num,
    addN: (lhs, rhs) => lhs + rhs,
    subN: (lhs, rhs) => lhs - rhs,
    mulN: (lhs, rhs) => lhs * rhs,
    inv: (num) => invert(num, ORDER),
    sqrt: redef.sqrt || ((n) => sqrtP(f, n)),
    invertBatch: (lst) => FpInvertBatch(f, lst),
    // TODO: do we really need constant cmov?
    // We don't have const-time bigints anyway, so probably will be not very useful
    cmov: (a, b, c) => c ? b : a,
    toBytes: (num) => isLE2 ? numberToBytesLE(num, BYTES) : numberToBytesBE(num, BYTES),
    fromBytes: (bytes2) => {
      if (bytes2.length !== BYTES)
        throw new Error(`Fp.fromBytes: expected ${BYTES}, got ${bytes2.length}`);
      return isLE2 ? bytesToNumberLE(bytes2) : bytesToNumberBE(bytes2);
    }
  });
  return Object.freeze(f);
}
function getFieldBytesLength(fieldOrder) {
  if (typeof fieldOrder !== "bigint")
    throw new Error("field order must be bigint");
  const bitLength = fieldOrder.toString(2).length;
  return Math.ceil(bitLength / 8);
}
function getMinHashLength(fieldOrder) {
  const length = getFieldBytesLength(fieldOrder);
  return length + Math.ceil(length / 2);
}
function mapHashToField(key, fieldOrder, isLE2 = false) {
  const len = key.length;
  const fieldLen = getFieldBytesLength(fieldOrder);
  const minLen = getMinHashLength(fieldOrder);
  if (len < 16 || len < minLen || len > 1024)
    throw new Error(`expected ${minLen}-1024 bytes of input, got ${len}`);
  const num = isLE2 ? bytesToNumberBE(key) : bytesToNumberLE(key);
  const reduced = mod(num, fieldOrder - _1n$3) + _1n$3;
  return isLE2 ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE(reduced, fieldLen);
}
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
const _0n$2 = BigInt(0);
const _1n$2 = BigInt(1);
function wNAF(c, bits) {
  const constTimeNegate = (condition, item) => {
    const neg = item.negate();
    return condition ? neg : item;
  };
  const opts = (W) => {
    const windows = Math.ceil(bits / W) + 1;
    const windowSize = 2 ** (W - 1);
    return { windows, windowSize };
  };
  return {
    constTimeNegate,
    // non-const time multiplication ladder
    unsafeLadder(elm, n) {
      let p2 = c.ZERO;
      let d = elm;
      while (n > _0n$2) {
        if (n & _1n$2)
          p2 = p2.add(d);
        d = d.double();
        n >>= _1n$2;
      }
      return p2;
    },
    /**
     * Creates a wNAF precomputation window. Used for caching.
     * Default window size is set by `utils.precompute()` and is equal to 8.
     * Number of precomputed points depends on the curve size:
     * 2^(𝑊−1) * (Math.ceil(𝑛 / 𝑊) + 1), where:
     * - 𝑊 is the window size
     * - 𝑛 is the bitlength of the curve order.
     * For a 256-bit curve and window size 8, the number of precomputed points is 128 * 33 = 4224.
     * @returns precomputed point tables flattened to a single array
     */
    precomputeWindow(elm, W) {
      const { windows, windowSize } = opts(W);
      const points = [];
      let p2 = elm;
      let base = p2;
      for (let window2 = 0; window2 < windows; window2++) {
        base = p2;
        points.push(base);
        for (let i2 = 1; i2 < windowSize; i2++) {
          base = base.add(p2);
          points.push(base);
        }
        p2 = base.double();
      }
      return points;
    },
    /**
     * Implements ec multiplication using precomputed tables and w-ary non-adjacent form.
     * @param W window size
     * @param precomputes precomputed tables
     * @param n scalar (we don't check here, but should be less than curve order)
     * @returns real and fake (for const-time) points
     */
    wNAF(W, precomputes, n) {
      const { windows, windowSize } = opts(W);
      let p2 = c.ZERO;
      let f = c.BASE;
      const mask = BigInt(2 ** W - 1);
      const maxNumber = 2 ** W;
      const shiftBy = BigInt(W);
      for (let window2 = 0; window2 < windows; window2++) {
        const offset = window2 * windowSize;
        let wbits = Number(n & mask);
        n >>= shiftBy;
        if (wbits > windowSize) {
          wbits -= maxNumber;
          n += _1n$2;
        }
        const offset1 = offset;
        const offset2 = offset + Math.abs(wbits) - 1;
        const cond1 = window2 % 2 !== 0;
        const cond2 = wbits < 0;
        if (wbits === 0) {
          f = f.add(constTimeNegate(cond1, precomputes[offset1]));
        } else {
          p2 = p2.add(constTimeNegate(cond2, precomputes[offset2]));
        }
      }
      return { p: p2, f };
    },
    wNAFCached(P, precomputesMap, n, transform) {
      const W = P._WINDOW_SIZE || 1;
      let comp = precomputesMap.get(P);
      if (!comp) {
        comp = this.precomputeWindow(P, W);
        if (W !== 1) {
          precomputesMap.set(P, transform(comp));
        }
      }
      return this.wNAF(W, comp, n);
    }
  };
}
function validateBasic(curve) {
  validateField(curve.Fp);
  validateObject(curve, {
    n: "bigint",
    h: "bigint",
    Gx: "field",
    Gy: "field"
  }, {
    nBitLength: "isSafeInteger",
    nByteLength: "isSafeInteger"
  });
  return Object.freeze({
    ...nLength(curve.n, curve.nBitLength),
    ...curve,
    ...{ p: curve.Fp.ORDER }
  });
}
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
function validatePointOpts(curve) {
  const opts = validateBasic(curve);
  validateObject(opts, {
    a: "field",
    b: "field"
  }, {
    allowedPrivateKeyLengths: "array",
    wrapPrivateKey: "boolean",
    isTorsionFree: "function",
    clearCofactor: "function",
    allowInfinityPoint: "boolean",
    fromBytes: "function",
    toBytes: "function"
  });
  const { endo, Fp: Fp2, a } = opts;
  if (endo) {
    if (!Fp2.eql(a, Fp2.ZERO)) {
      throw new Error("Endomorphism can only be defined for Koblitz curves that have a=0");
    }
    if (typeof endo !== "object" || typeof endo.beta !== "bigint" || typeof endo.splitScalar !== "function") {
      throw new Error("Expected endomorphism with beta: bigint and splitScalar: function");
    }
  }
  return Object.freeze({ ...opts });
}
const { bytesToNumberBE: b2n, hexToBytes: h2b } = ut;
const DER = {
  // asn.1 DER encoding utils
  Err: class DERErr extends Error {
    constructor(m = "") {
      super(m);
    }
  },
  _parseInt(data) {
    const { Err: E } = DER;
    if (data.length < 2 || data[0] !== 2)
      throw new E("Invalid signature integer tag");
    const len = data[1];
    const res = data.subarray(2, len + 2);
    if (!len || res.length !== len)
      throw new E("Invalid signature integer: wrong length");
    if (res[0] & 128)
      throw new E("Invalid signature integer: negative");
    if (res[0] === 0 && !(res[1] & 128))
      throw new E("Invalid signature integer: unnecessary leading zero");
    return { d: b2n(res), l: data.subarray(len + 2) };
  },
  toSig(hex2) {
    const { Err: E } = DER;
    const data = typeof hex2 === "string" ? h2b(hex2) : hex2;
    if (!(data instanceof Uint8Array))
      throw new Error("ui8a expected");
    let l = data.length;
    if (l < 2 || data[0] != 48)
      throw new E("Invalid signature tag");
    if (data[1] !== l - 2)
      throw new E("Invalid signature: incorrect length");
    const { d: r, l: sBytes } = DER._parseInt(data.subarray(2));
    const { d: s, l: rBytesLeft } = DER._parseInt(sBytes);
    if (rBytesLeft.length)
      throw new E("Invalid signature: left bytes after parsing");
    return { r, s };
  },
  hexFromSig(sig) {
    const slice = (s2) => Number.parseInt(s2[0], 16) & 8 ? "00" + s2 : s2;
    const h2 = (num) => {
      const hex2 = num.toString(16);
      return hex2.length & 1 ? `0${hex2}` : hex2;
    };
    const s = slice(h2(sig.s));
    const r = slice(h2(sig.r));
    const shl = s.length / 2;
    const rhl = r.length / 2;
    const sl = h2(shl);
    const rl = h2(rhl);
    return `30${h2(rhl + shl + 4)}02${rl}${r}02${sl}${s}`;
  }
};
const _0n$1 = BigInt(0), _1n$1 = BigInt(1);
BigInt(2);
const _3n = BigInt(3);
BigInt(4);
function weierstrassPoints(opts) {
  const CURVE = validatePointOpts(opts);
  const { Fp: Fp2 } = CURVE;
  const toBytes2 = CURVE.toBytes || ((_c, point, _isCompressed) => {
    const a = point.toAffine();
    return concatBytes$1(Uint8Array.from([4]), Fp2.toBytes(a.x), Fp2.toBytes(a.y));
  });
  const fromBytes = CURVE.fromBytes || ((bytes2) => {
    const tail = bytes2.subarray(1);
    const x = Fp2.fromBytes(tail.subarray(0, Fp2.BYTES));
    const y = Fp2.fromBytes(tail.subarray(Fp2.BYTES, 2 * Fp2.BYTES));
    return { x, y };
  });
  function weierstrassEquation(x) {
    const { a, b } = CURVE;
    const x2 = Fp2.sqr(x);
    const x3 = Fp2.mul(x2, x);
    return Fp2.add(Fp2.add(x3, Fp2.mul(x, a)), b);
  }
  if (!Fp2.eql(Fp2.sqr(CURVE.Gy), weierstrassEquation(CURVE.Gx)))
    throw new Error("bad generator point: equation left != right");
  function isWithinCurveOrder(num) {
    return typeof num === "bigint" && _0n$1 < num && num < CURVE.n;
  }
  function assertGE(num) {
    if (!isWithinCurveOrder(num))
      throw new Error("Expected valid bigint: 0 < bigint < curve.n");
  }
  function normPrivateKeyToScalar(key) {
    const { allowedPrivateKeyLengths: lengths, nByteLength, wrapPrivateKey, n } = CURVE;
    if (lengths && typeof key !== "bigint") {
      if (key instanceof Uint8Array)
        key = bytesToHex$2(key);
      if (typeof key !== "string" || !lengths.includes(key.length))
        throw new Error("Invalid key");
      key = key.padStart(nByteLength * 2, "0");
    }
    let num;
    try {
      num = typeof key === "bigint" ? key : bytesToNumberBE(ensureBytes("private key", key, nByteLength));
    } catch (error) {
      throw new Error(`private key must be ${nByteLength} bytes, hex or bigint, not ${typeof key}`);
    }
    if (wrapPrivateKey)
      num = mod(num, n);
    assertGE(num);
    return num;
  }
  const pointPrecomputes = /* @__PURE__ */ new Map();
  function assertPrjPoint(other) {
    if (!(other instanceof Point2))
      throw new Error("ProjectivePoint expected");
  }
  class Point2 {
    constructor(px, py, pz) {
      this.px = px;
      this.py = py;
      this.pz = pz;
      if (px == null || !Fp2.isValid(px))
        throw new Error("x required");
      if (py == null || !Fp2.isValid(py))
        throw new Error("y required");
      if (pz == null || !Fp2.isValid(pz))
        throw new Error("z required");
    }
    // Does not validate if the point is on-curve.
    // Use fromHex instead, or call assertValidity() later.
    static fromAffine(p2) {
      const { x, y } = p2 || {};
      if (!p2 || !Fp2.isValid(x) || !Fp2.isValid(y))
        throw new Error("invalid affine point");
      if (p2 instanceof Point2)
        throw new Error("projective point not allowed");
      const is0 = (i2) => Fp2.eql(i2, Fp2.ZERO);
      if (is0(x) && is0(y))
        return Point2.ZERO;
      return new Point2(x, y, Fp2.ONE);
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    /**
     * Takes a bunch of Projective Points but executes only one
     * inversion on all of them. Inversion is very slow operation,
     * so this improves performance massively.
     * Optimization: converts a list of projective points to a list of identical points with Z=1.
     */
    static normalizeZ(points) {
      const toInv = Fp2.invertBatch(points.map((p2) => p2.pz));
      return points.map((p2, i2) => p2.toAffine(toInv[i2])).map(Point2.fromAffine);
    }
    /**
     * Converts hash string or Uint8Array to Point.
     * @param hex short/long ECDSA hex
     */
    static fromHex(hex2) {
      const P = Point2.fromAffine(fromBytes(ensureBytes("pointHex", hex2)));
      P.assertValidity();
      return P;
    }
    // Multiplies generator point by privateKey.
    static fromPrivateKey(privateKey) {
      return Point2.BASE.multiply(normPrivateKeyToScalar(privateKey));
    }
    // "Private method", don't use it directly
    _setWindowSize(windowSize) {
      this._WINDOW_SIZE = windowSize;
      pointPrecomputes.delete(this);
    }
    // A point on curve is valid if it conforms to equation.
    assertValidity() {
      if (this.is0()) {
        if (CURVE.allowInfinityPoint && !Fp2.is0(this.py))
          return;
        throw new Error("bad point: ZERO");
      }
      const { x, y } = this.toAffine();
      if (!Fp2.isValid(x) || !Fp2.isValid(y))
        throw new Error("bad point: x or y not FE");
      const left = Fp2.sqr(y);
      const right = weierstrassEquation(x);
      if (!Fp2.eql(left, right))
        throw new Error("bad point: equation left != right");
      if (!this.isTorsionFree())
        throw new Error("bad point: not in prime-order subgroup");
    }
    hasEvenY() {
      const { y } = this.toAffine();
      if (Fp2.isOdd)
        return !Fp2.isOdd(y);
      throw new Error("Field doesn't support isOdd");
    }
    /**
     * Compare one point to another.
     */
    equals(other) {
      assertPrjPoint(other);
      const { px: X1, py: Y1, pz: Z1 } = this;
      const { px: X2, py: Y2, pz: Z2 } = other;
      const U1 = Fp2.eql(Fp2.mul(X1, Z2), Fp2.mul(X2, Z1));
      const U2 = Fp2.eql(Fp2.mul(Y1, Z2), Fp2.mul(Y2, Z1));
      return U1 && U2;
    }
    /**
     * Flips point to one corresponding to (x, -y) in Affine coordinates.
     */
    negate() {
      return new Point2(this.px, Fp2.neg(this.py), this.pz);
    }
    // Renes-Costello-Batina exception-free doubling formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 3
    // Cost: 8M + 3S + 3*a + 2*b3 + 15add.
    double() {
      const { a, b } = CURVE;
      const b3 = Fp2.mul(b, _3n);
      const { px: X1, py: Y1, pz: Z1 } = this;
      let X3 = Fp2.ZERO, Y3 = Fp2.ZERO, Z3 = Fp2.ZERO;
      let t0 = Fp2.mul(X1, X1);
      let t1 = Fp2.mul(Y1, Y1);
      let t2 = Fp2.mul(Z1, Z1);
      let t3 = Fp2.mul(X1, Y1);
      t3 = Fp2.add(t3, t3);
      Z3 = Fp2.mul(X1, Z1);
      Z3 = Fp2.add(Z3, Z3);
      X3 = Fp2.mul(a, Z3);
      Y3 = Fp2.mul(b3, t2);
      Y3 = Fp2.add(X3, Y3);
      X3 = Fp2.sub(t1, Y3);
      Y3 = Fp2.add(t1, Y3);
      Y3 = Fp2.mul(X3, Y3);
      X3 = Fp2.mul(t3, X3);
      Z3 = Fp2.mul(b3, Z3);
      t2 = Fp2.mul(a, t2);
      t3 = Fp2.sub(t0, t2);
      t3 = Fp2.mul(a, t3);
      t3 = Fp2.add(t3, Z3);
      Z3 = Fp2.add(t0, t0);
      t0 = Fp2.add(Z3, t0);
      t0 = Fp2.add(t0, t2);
      t0 = Fp2.mul(t0, t3);
      Y3 = Fp2.add(Y3, t0);
      t2 = Fp2.mul(Y1, Z1);
      t2 = Fp2.add(t2, t2);
      t0 = Fp2.mul(t2, t3);
      X3 = Fp2.sub(X3, t0);
      Z3 = Fp2.mul(t2, t1);
      Z3 = Fp2.add(Z3, Z3);
      Z3 = Fp2.add(Z3, Z3);
      return new Point2(X3, Y3, Z3);
    }
    // Renes-Costello-Batina exception-free addition formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 1
    // Cost: 12M + 0S + 3*a + 3*b3 + 23add.
    add(other) {
      assertPrjPoint(other);
      const { px: X1, py: Y1, pz: Z1 } = this;
      const { px: X2, py: Y2, pz: Z2 } = other;
      let X3 = Fp2.ZERO, Y3 = Fp2.ZERO, Z3 = Fp2.ZERO;
      const a = CURVE.a;
      const b3 = Fp2.mul(CURVE.b, _3n);
      let t0 = Fp2.mul(X1, X2);
      let t1 = Fp2.mul(Y1, Y2);
      let t2 = Fp2.mul(Z1, Z2);
      let t3 = Fp2.add(X1, Y1);
      let t4 = Fp2.add(X2, Y2);
      t3 = Fp2.mul(t3, t4);
      t4 = Fp2.add(t0, t1);
      t3 = Fp2.sub(t3, t4);
      t4 = Fp2.add(X1, Z1);
      let t5 = Fp2.add(X2, Z2);
      t4 = Fp2.mul(t4, t5);
      t5 = Fp2.add(t0, t2);
      t4 = Fp2.sub(t4, t5);
      t5 = Fp2.add(Y1, Z1);
      X3 = Fp2.add(Y2, Z2);
      t5 = Fp2.mul(t5, X3);
      X3 = Fp2.add(t1, t2);
      t5 = Fp2.sub(t5, X3);
      Z3 = Fp2.mul(a, t4);
      X3 = Fp2.mul(b3, t2);
      Z3 = Fp2.add(X3, Z3);
      X3 = Fp2.sub(t1, Z3);
      Z3 = Fp2.add(t1, Z3);
      Y3 = Fp2.mul(X3, Z3);
      t1 = Fp2.add(t0, t0);
      t1 = Fp2.add(t1, t0);
      t2 = Fp2.mul(a, t2);
      t4 = Fp2.mul(b3, t4);
      t1 = Fp2.add(t1, t2);
      t2 = Fp2.sub(t0, t2);
      t2 = Fp2.mul(a, t2);
      t4 = Fp2.add(t4, t2);
      t0 = Fp2.mul(t1, t4);
      Y3 = Fp2.add(Y3, t0);
      t0 = Fp2.mul(t5, t4);
      X3 = Fp2.mul(t3, X3);
      X3 = Fp2.sub(X3, t0);
      t0 = Fp2.mul(t3, t1);
      Z3 = Fp2.mul(t5, Z3);
      Z3 = Fp2.add(Z3, t0);
      return new Point2(X3, Y3, Z3);
    }
    subtract(other) {
      return this.add(other.negate());
    }
    is0() {
      return this.equals(Point2.ZERO);
    }
    wNAF(n) {
      return wnaf.wNAFCached(this, pointPrecomputes, n, (comp) => {
        const toInv = Fp2.invertBatch(comp.map((p2) => p2.pz));
        return comp.map((p2, i2) => p2.toAffine(toInv[i2])).map(Point2.fromAffine);
      });
    }
    /**
     * Non-constant-time multiplication. Uses double-and-add algorithm.
     * It's faster, but should only be used when you don't care about
     * an exposed private key e.g. sig verification, which works over *public* keys.
     */
    multiplyUnsafe(n) {
      const I = Point2.ZERO;
      if (n === _0n$1)
        return I;
      assertGE(n);
      if (n === _1n$1)
        return this;
      const { endo } = CURVE;
      if (!endo)
        return wnaf.unsafeLadder(this, n);
      let { k1neg, k1, k2neg, k2 } = endo.splitScalar(n);
      let k1p = I;
      let k2p = I;
      let d = this;
      while (k1 > _0n$1 || k2 > _0n$1) {
        if (k1 & _1n$1)
          k1p = k1p.add(d);
        if (k2 & _1n$1)
          k2p = k2p.add(d);
        d = d.double();
        k1 >>= _1n$1;
        k2 >>= _1n$1;
      }
      if (k1neg)
        k1p = k1p.negate();
      if (k2neg)
        k2p = k2p.negate();
      k2p = new Point2(Fp2.mul(k2p.px, endo.beta), k2p.py, k2p.pz);
      return k1p.add(k2p);
    }
    /**
     * Constant time multiplication.
     * Uses wNAF method. Windowed method may be 10% faster,
     * but takes 2x longer to generate and consumes 2x memory.
     * Uses precomputes when available.
     * Uses endomorphism for Koblitz curves.
     * @param scalar by which the point would be multiplied
     * @returns New point
     */
    multiply(scalar) {
      assertGE(scalar);
      let n = scalar;
      let point, fake;
      const { endo } = CURVE;
      if (endo) {
        const { k1neg, k1, k2neg, k2 } = endo.splitScalar(n);
        let { p: k1p, f: f1p } = this.wNAF(k1);
        let { p: k2p, f: f2p } = this.wNAF(k2);
        k1p = wnaf.constTimeNegate(k1neg, k1p);
        k2p = wnaf.constTimeNegate(k2neg, k2p);
        k2p = new Point2(Fp2.mul(k2p.px, endo.beta), k2p.py, k2p.pz);
        point = k1p.add(k2p);
        fake = f1p.add(f2p);
      } else {
        const { p: p2, f } = this.wNAF(n);
        point = p2;
        fake = f;
      }
      return Point2.normalizeZ([point, fake])[0];
    }
    /**
     * Efficiently calculate `aP + bQ`. Unsafe, can expose private key, if used incorrectly.
     * Not using Strauss-Shamir trick: precomputation tables are faster.
     * The trick could be useful if both P and Q are not G (not in our case).
     * @returns non-zero affine point
     */
    multiplyAndAddUnsafe(Q, a, b) {
      const G = Point2.BASE;
      const mul3 = (P, a2) => a2 === _0n$1 || a2 === _1n$1 || !P.equals(G) ? P.multiplyUnsafe(a2) : P.multiply(a2);
      const sum = mul3(this, a).add(mul3(Q, b));
      return sum.is0() ? void 0 : sum;
    }
    // Converts Projective point to affine (x, y) coordinates.
    // Can accept precomputed Z^-1 - for example, from invertBatch.
    // (x, y, z) ∋ (x=x/z, y=y/z)
    toAffine(iz) {
      const { px: x, py: y, pz: z } = this;
      const is0 = this.is0();
      if (iz == null)
        iz = is0 ? Fp2.ONE : Fp2.inv(z);
      const ax = Fp2.mul(x, iz);
      const ay = Fp2.mul(y, iz);
      const zz = Fp2.mul(z, iz);
      if (is0)
        return { x: Fp2.ZERO, y: Fp2.ZERO };
      if (!Fp2.eql(zz, Fp2.ONE))
        throw new Error("invZ was invalid");
      return { x: ax, y: ay };
    }
    isTorsionFree() {
      const { h: cofactor, isTorsionFree } = CURVE;
      if (cofactor === _1n$1)
        return true;
      if (isTorsionFree)
        return isTorsionFree(Point2, this);
      throw new Error("isTorsionFree() has not been declared for the elliptic curve");
    }
    clearCofactor() {
      const { h: cofactor, clearCofactor } = CURVE;
      if (cofactor === _1n$1)
        return this;
      if (clearCofactor)
        return clearCofactor(Point2, this);
      return this.multiplyUnsafe(CURVE.h);
    }
    toRawBytes(isCompressed = true) {
      this.assertValidity();
      return toBytes2(Point2, this, isCompressed);
    }
    toHex(isCompressed = true) {
      return bytesToHex$2(this.toRawBytes(isCompressed));
    }
  }
  Point2.BASE = new Point2(CURVE.Gx, CURVE.Gy, Fp2.ONE);
  Point2.ZERO = new Point2(Fp2.ZERO, Fp2.ONE, Fp2.ZERO);
  const _bits = CURVE.nBitLength;
  const wnaf = wNAF(Point2, CURVE.endo ? Math.ceil(_bits / 2) : _bits);
  return {
    CURVE,
    ProjectivePoint: Point2,
    normPrivateKeyToScalar,
    weierstrassEquation,
    isWithinCurveOrder
  };
}
function validateOpts(curve) {
  const opts = validateBasic(curve);
  validateObject(opts, {
    hash: "hash",
    hmac: "function",
    randomBytes: "function"
  }, {
    bits2int: "function",
    bits2int_modN: "function",
    lowS: "boolean"
  });
  return Object.freeze({ lowS: true, ...opts });
}
function weierstrass(curveDef) {
  const CURVE = validateOpts(curveDef);
  const { Fp: Fp2, n: CURVE_ORDER } = CURVE;
  const compressedLen = Fp2.BYTES + 1;
  const uncompressedLen = 2 * Fp2.BYTES + 1;
  function isValidFieldElement(num) {
    return _0n$1 < num && num < Fp2.ORDER;
  }
  function modN2(a) {
    return mod(a, CURVE_ORDER);
  }
  function invN(a) {
    return invert(a, CURVE_ORDER);
  }
  const { ProjectivePoint: Point2, normPrivateKeyToScalar, weierstrassEquation, isWithinCurveOrder } = weierstrassPoints({
    ...CURVE,
    toBytes(_c, point, isCompressed) {
      const a = point.toAffine();
      const x = Fp2.toBytes(a.x);
      const cat = concatBytes$1;
      if (isCompressed) {
        return cat(Uint8Array.from([point.hasEvenY() ? 2 : 3]), x);
      } else {
        return cat(Uint8Array.from([4]), x, Fp2.toBytes(a.y));
      }
    },
    fromBytes(bytes2) {
      const len = bytes2.length;
      const head = bytes2[0];
      const tail = bytes2.subarray(1);
      if (len === compressedLen && (head === 2 || head === 3)) {
        const x = bytesToNumberBE(tail);
        if (!isValidFieldElement(x))
          throw new Error("Point is not on curve");
        const y2 = weierstrassEquation(x);
        let y = Fp2.sqrt(y2);
        const isYOdd = (y & _1n$1) === _1n$1;
        const isHeadOdd = (head & 1) === 1;
        if (isHeadOdd !== isYOdd)
          y = Fp2.neg(y);
        return { x, y };
      } else if (len === uncompressedLen && head === 4) {
        const x = Fp2.fromBytes(tail.subarray(0, Fp2.BYTES));
        const y = Fp2.fromBytes(tail.subarray(Fp2.BYTES, 2 * Fp2.BYTES));
        return { x, y };
      } else {
        throw new Error(`Point of length ${len} was invalid. Expected ${compressedLen} compressed bytes or ${uncompressedLen} uncompressed bytes`);
      }
    }
  });
  const numToNByteStr = (num) => bytesToHex$2(numberToBytesBE(num, CURVE.nByteLength));
  function isBiggerThanHalfOrder(number2) {
    const HALF = CURVE_ORDER >> _1n$1;
    return number2 > HALF;
  }
  function normalizeS(s) {
    return isBiggerThanHalfOrder(s) ? modN2(-s) : s;
  }
  const slcNum = (b, from, to) => bytesToNumberBE(b.slice(from, to));
  class Signature {
    constructor(r, s, recovery) {
      this.r = r;
      this.s = s;
      this.recovery = recovery;
      this.assertValidity();
    }
    // pair (bytes of r, bytes of s)
    static fromCompact(hex2) {
      const l = CURVE.nByteLength;
      hex2 = ensureBytes("compactSignature", hex2, l * 2);
      return new Signature(slcNum(hex2, 0, l), slcNum(hex2, l, 2 * l));
    }
    // DER encoded ECDSA signature
    // https://bitcoin.stackexchange.com/questions/57644/what-are-the-parts-of-a-bitcoin-transaction-input-script
    static fromDER(hex2) {
      const { r, s } = DER.toSig(ensureBytes("DER", hex2));
      return new Signature(r, s);
    }
    assertValidity() {
      if (!isWithinCurveOrder(this.r))
        throw new Error("r must be 0 < r < CURVE.n");
      if (!isWithinCurveOrder(this.s))
        throw new Error("s must be 0 < s < CURVE.n");
    }
    addRecoveryBit(recovery) {
      return new Signature(this.r, this.s, recovery);
    }
    recoverPublicKey(msgHash) {
      const { r, s, recovery: rec } = this;
      const h2 = bits2int_modN(ensureBytes("msgHash", msgHash));
      if (rec == null || ![0, 1, 2, 3].includes(rec))
        throw new Error("recovery id invalid");
      const radj = rec === 2 || rec === 3 ? r + CURVE.n : r;
      if (radj >= Fp2.ORDER)
        throw new Error("recovery id 2 or 3 invalid");
      const prefix = (rec & 1) === 0 ? "02" : "03";
      const R = Point2.fromHex(prefix + numToNByteStr(radj));
      const ir = invN(radj);
      const u1 = modN2(-h2 * ir);
      const u2 = modN2(s * ir);
      const Q = Point2.BASE.multiplyAndAddUnsafe(R, u1, u2);
      if (!Q)
        throw new Error("point at infinify");
      Q.assertValidity();
      return Q;
    }
    // Signatures should be low-s, to prevent malleability.
    hasHighS() {
      return isBiggerThanHalfOrder(this.s);
    }
    normalizeS() {
      return this.hasHighS() ? new Signature(this.r, modN2(-this.s), this.recovery) : this;
    }
    // DER-encoded
    toDERRawBytes() {
      return hexToBytes$2(this.toDERHex());
    }
    toDERHex() {
      return DER.hexFromSig({ r: this.r, s: this.s });
    }
    // padded bytes of r, then padded bytes of s
    toCompactRawBytes() {
      return hexToBytes$2(this.toCompactHex());
    }
    toCompactHex() {
      return numToNByteStr(this.r) + numToNByteStr(this.s);
    }
  }
  const utils = {
    isValidPrivateKey(privateKey) {
      try {
        normPrivateKeyToScalar(privateKey);
        return true;
      } catch (error) {
        return false;
      }
    },
    normPrivateKeyToScalar,
    /**
     * Produces cryptographically secure private key from random of size
     * (groupLen + ceil(groupLen / 2)) with modulo bias being negligible.
     */
    randomPrivateKey: () => {
      const length = getMinHashLength(CURVE.n);
      return mapHashToField(CURVE.randomBytes(length), CURVE.n);
    },
    /**
     * Creates precompute table for an arbitrary EC point. Makes point "cached".
     * Allows to massively speed-up `point.multiply(scalar)`.
     * @returns cached point
     * @example
     * const fast = utils.precompute(8, ProjectivePoint.fromHex(someonesPubKey));
     * fast.multiply(privKey); // much faster ECDH now
     */
    precompute(windowSize = 8, point = Point2.BASE) {
      point._setWindowSize(windowSize);
      point.multiply(BigInt(3));
      return point;
    }
  };
  function getPublicKey2(privateKey, isCompressed = true) {
    return Point2.fromPrivateKey(privateKey).toRawBytes(isCompressed);
  }
  function isProbPub(item) {
    const arr = item instanceof Uint8Array;
    const str = typeof item === "string";
    const len = (arr || str) && item.length;
    if (arr)
      return len === compressedLen || len === uncompressedLen;
    if (str)
      return len === 2 * compressedLen || len === 2 * uncompressedLen;
    if (item instanceof Point2)
      return true;
    return false;
  }
  function getSharedSecret(privateA, publicB, isCompressed = true) {
    if (isProbPub(privateA))
      throw new Error("first arg must be private key");
    if (!isProbPub(publicB))
      throw new Error("second arg must be public key");
    const b = Point2.fromHex(publicB);
    return b.multiply(normPrivateKeyToScalar(privateA)).toRawBytes(isCompressed);
  }
  const bits2int = CURVE.bits2int || function(bytes2) {
    const num = bytesToNumberBE(bytes2);
    const delta = bytes2.length * 8 - CURVE.nBitLength;
    return delta > 0 ? num >> BigInt(delta) : num;
  };
  const bits2int_modN = CURVE.bits2int_modN || function(bytes2) {
    return modN2(bits2int(bytes2));
  };
  const ORDER_MASK = bitMask(CURVE.nBitLength);
  function int2octets(num) {
    if (typeof num !== "bigint")
      throw new Error("bigint expected");
    if (!(_0n$1 <= num && num < ORDER_MASK))
      throw new Error(`bigint expected < 2^${CURVE.nBitLength}`);
    return numberToBytesBE(num, CURVE.nByteLength);
  }
  function prepSig(msgHash, privateKey, opts = defaultSigOpts) {
    if (["recovered", "canonical"].some((k) => k in opts))
      throw new Error("sign() legacy options not supported");
    const { hash: hash2, randomBytes: randomBytes2 } = CURVE;
    let { lowS, prehash, extraEntropy: ent } = opts;
    if (lowS == null)
      lowS = true;
    msgHash = ensureBytes("msgHash", msgHash);
    if (prehash)
      msgHash = ensureBytes("prehashed msgHash", hash2(msgHash));
    const h1int = bits2int_modN(msgHash);
    const d = normPrivateKeyToScalar(privateKey);
    const seedArgs = [int2octets(d), int2octets(h1int)];
    if (ent != null) {
      const e = ent === true ? randomBytes2(Fp2.BYTES) : ent;
      seedArgs.push(ensureBytes("extraEntropy", e));
    }
    const seed = concatBytes$1(...seedArgs);
    const m = h1int;
    function k2sig(kBytes) {
      const k = bits2int(kBytes);
      if (!isWithinCurveOrder(k))
        return;
      const ik = invN(k);
      const q = Point2.BASE.multiply(k).toAffine();
      const r = modN2(q.x);
      if (r === _0n$1)
        return;
      const s = modN2(ik * modN2(m + r * d));
      if (s === _0n$1)
        return;
      let recovery = (q.x === r ? 0 : 2) | Number(q.y & _1n$1);
      let normS = s;
      if (lowS && isBiggerThanHalfOrder(s)) {
        normS = normalizeS(s);
        recovery ^= 1;
      }
      return new Signature(r, normS, recovery);
    }
    return { seed, k2sig };
  }
  const defaultSigOpts = { lowS: CURVE.lowS, prehash: false };
  const defaultVerOpts = { lowS: CURVE.lowS, prehash: false };
  function sign(msgHash, privKey, opts = defaultSigOpts) {
    const { seed, k2sig } = prepSig(msgHash, privKey, opts);
    const C = CURVE;
    const drbg = createHmacDrbg(C.hash.outputLen, C.nByteLength, C.hmac);
    return drbg(seed, k2sig);
  }
  Point2.BASE._setWindowSize(8);
  function verify(signature, msgHash, publicKey, opts = defaultVerOpts) {
    var _a;
    const sg = signature;
    msgHash = ensureBytes("msgHash", msgHash);
    publicKey = ensureBytes("publicKey", publicKey);
    if ("strict" in opts)
      throw new Error("options.strict was renamed to lowS");
    const { lowS, prehash } = opts;
    let _sig = void 0;
    let P;
    try {
      if (typeof sg === "string" || sg instanceof Uint8Array) {
        try {
          _sig = Signature.fromDER(sg);
        } catch (derError) {
          if (!(derError instanceof DER.Err))
            throw derError;
          _sig = Signature.fromCompact(sg);
        }
      } else if (typeof sg === "object" && typeof sg.r === "bigint" && typeof sg.s === "bigint") {
        const { r: r2, s: s2 } = sg;
        _sig = new Signature(r2, s2);
      } else {
        throw new Error("PARSE");
      }
      P = Point2.fromHex(publicKey);
    } catch (error) {
      if (error.message === "PARSE")
        throw new Error(`signature must be Signature instance, Uint8Array or hex string`);
      return false;
    }
    if (lowS && _sig.hasHighS())
      return false;
    if (prehash)
      msgHash = CURVE.hash(msgHash);
    const { r, s } = _sig;
    const h2 = bits2int_modN(msgHash);
    const is = invN(s);
    const u1 = modN2(h2 * is);
    const u2 = modN2(r * is);
    const R = (_a = Point2.BASE.multiplyAndAddUnsafe(P, u1, u2)) == null ? void 0 : _a.toAffine();
    if (!R)
      return false;
    const v = modN2(R.x);
    return v === r;
  }
  return {
    CURVE,
    getPublicKey: getPublicKey2,
    getSharedSecret,
    sign,
    verify,
    ProjectivePoint: Point2,
    Signature,
    utils
  };
}
let HMAC$1 = class HMAC extends Hash$2 {
  constructor(hash2, _key) {
    super();
    this.finished = false;
    this.destroyed = false;
    hash$1(hash2);
    const key = toBytes$2(_key);
    this.iHash = hash2.create();
    if (typeof this.iHash.update !== "function")
      throw new Error("Expected instance of class which extends utils.Hash");
    this.blockLen = this.iHash.blockLen;
    this.outputLen = this.iHash.outputLen;
    const blockLen = this.blockLen;
    const pad = new Uint8Array(blockLen);
    pad.set(key.length > blockLen ? hash2.create().update(key).digest() : key);
    for (let i2 = 0; i2 < pad.length; i2++)
      pad[i2] ^= 54;
    this.iHash.update(pad);
    this.oHash = hash2.create();
    for (let i2 = 0; i2 < pad.length; i2++)
      pad[i2] ^= 54 ^ 92;
    this.oHash.update(pad);
    pad.fill(0);
  }
  update(buf) {
    exists$2(this);
    this.iHash.update(buf);
    return this;
  }
  digestInto(out) {
    exists$2(this);
    bytes$3(out, this.outputLen);
    this.finished = true;
    this.iHash.digestInto(out);
    this.oHash.update(out);
    this.oHash.digestInto(out);
    this.destroy();
  }
  digest() {
    const out = new Uint8Array(this.oHash.outputLen);
    this.digestInto(out);
    return out;
  }
  _cloneInto(to) {
    to || (to = Object.create(Object.getPrototypeOf(this), {}));
    const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
    to = to;
    to.finished = finished;
    to.destroyed = destroyed;
    to.blockLen = blockLen;
    to.outputLen = outputLen;
    to.oHash = oHash._cloneInto(to.oHash);
    to.iHash = iHash._cloneInto(to.iHash);
    return to;
  }
  destroy() {
    this.destroyed = true;
    this.oHash.destroy();
    this.iHash.destroy();
  }
};
const hmac$1 = (hash2, key, message) => new HMAC$1(hash2, key).update(message).digest();
hmac$1.create = (hash2, key) => new HMAC$1(hash2, key);
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
function getHash(hash2) {
  return {
    hash: hash2,
    hmac: (key, ...msgs) => hmac$1(hash2, key, concatBytes$2(...msgs)),
    randomBytes: randomBytes$1
  };
}
function createCurve(curveDef, defHash) {
  const create = (hash2) => weierstrass({ ...curveDef, ...getHash(hash2) });
  return Object.freeze({ ...create(defHash), create });
}
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
const secp256k1P = BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f");
const secp256k1N = BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141");
const _1n = BigInt(1);
const _2n = BigInt(2);
const divNearest = (a, b) => (a + b / _2n) / b;
function sqrtMod(y) {
  const P = secp256k1P;
  const _3n2 = BigInt(3), _6n = BigInt(6), _11n = BigInt(11), _22n = BigInt(22);
  const _23n = BigInt(23), _44n = BigInt(44), _88n = BigInt(88);
  const b2 = y * y * y % P;
  const b3 = b2 * b2 * y % P;
  const b6 = pow2(b3, _3n2, P) * b3 % P;
  const b9 = pow2(b6, _3n2, P) * b3 % P;
  const b11 = pow2(b9, _2n, P) * b2 % P;
  const b22 = pow2(b11, _11n, P) * b11 % P;
  const b44 = pow2(b22, _22n, P) * b22 % P;
  const b88 = pow2(b44, _44n, P) * b44 % P;
  const b176 = pow2(b88, _88n, P) * b88 % P;
  const b220 = pow2(b176, _44n, P) * b44 % P;
  const b223 = pow2(b220, _3n2, P) * b3 % P;
  const t1 = pow2(b223, _23n, P) * b22 % P;
  const t2 = pow2(t1, _6n, P) * b2 % P;
  const root = pow2(t2, _2n, P);
  if (!Fp.eql(Fp.sqr(root), y))
    throw new Error("Cannot find square root");
  return root;
}
const Fp = Field(secp256k1P, void 0, void 0, { sqrt: sqrtMod });
const secp256k1 = createCurve({
  a: BigInt(0),
  b: BigInt(7),
  Fp,
  n: secp256k1N,
  // Base point (x, y) aka generator point
  Gx: BigInt("55066263022277343669578718895168534326250603453777594175500187360389116729240"),
  Gy: BigInt("32670510020758816978083085130507043184471273380659243275938904335757337482424"),
  h: BigInt(1),
  lowS: true,
  /**
   * secp256k1 belongs to Koblitz curves: it has efficiently computable endomorphism.
   * Endomorphism uses 2x less RAM, speeds up precomputation by 2x and ECDH / key recovery by 20%.
   * For precomputed wNAF it trades off 1/2 init time & 1/3 ram for 20% perf hit.
   * Explanation: https://gist.github.com/paulmillr/eb670806793e84df628a7c434a873066
   */
  endo: {
    beta: BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),
    splitScalar: (k) => {
      const n = secp256k1N;
      const a1 = BigInt("0x3086d221a7d46bcde86c90e49284eb15");
      const b1 = -_1n * BigInt("0xe4437ed6010e88286f547fa90abfe4c3");
      const a2 = BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8");
      const b2 = a1;
      const POW_2_128 = BigInt("0x100000000000000000000000000000000");
      const c1 = divNearest(b2 * k, n);
      const c2 = divNearest(-b1 * k, n);
      let k1 = mod(k - c1 * a1 - c2 * a2, n);
      let k2 = mod(-c1 * b1 - c2 * b2, n);
      const k1neg = k1 > POW_2_128;
      const k2neg = k2 > POW_2_128;
      if (k1neg)
        k1 = n - k1;
      if (k2neg)
        k2 = n - k2;
      if (k1 > POW_2_128 || k2 > POW_2_128) {
        throw new Error("splitScalar: Endomorphism failed, k=" + k);
      }
      return { k1neg, k1, k2neg, k2 };
    }
  }
}, sha256$2);
const _0n = BigInt(0);
const fe = (x) => typeof x === "bigint" && _0n < x && x < secp256k1P;
const ge = (x) => typeof x === "bigint" && _0n < x && x < secp256k1N;
const TAGGED_HASH_PREFIXES = {};
function taggedHash(tag, ...messages) {
  let tagP = TAGGED_HASH_PREFIXES[tag];
  if (tagP === void 0) {
    const tagH = sha256$2(Uint8Array.from(tag, (c) => c.charCodeAt(0)));
    tagP = concatBytes$1(tagH, tagH);
    TAGGED_HASH_PREFIXES[tag] = tagP;
  }
  return sha256$2(concatBytes$1(tagP, ...messages));
}
const pointToBytes = (point) => point.toRawBytes(true).slice(1);
const numTo32b = (n) => numberToBytesBE(n, 32);
const modP = (x) => mod(x, secp256k1P);
const modN = (x) => mod(x, secp256k1N);
const Point = secp256k1.ProjectivePoint;
const GmulAdd = (Q, a, b) => Point.BASE.multiplyAndAddUnsafe(Q, a, b);
function schnorrGetExtPubKey(priv) {
  let d_ = secp256k1.utils.normPrivateKeyToScalar(priv);
  let p2 = Point.fromPrivateKey(d_);
  const scalar = p2.hasEvenY() ? d_ : modN(-d_);
  return { scalar, bytes: pointToBytes(p2) };
}
function lift_x(x) {
  if (!fe(x))
    throw new Error("bad x: need 0 < x < p");
  const xx = modP(x * x);
  const c = modP(xx * x + BigInt(7));
  let y = sqrtMod(c);
  if (y % _2n !== _0n)
    y = modP(-y);
  const p2 = new Point(x, y, _1n);
  p2.assertValidity();
  return p2;
}
function challenge(...args) {
  return modN(bytesToNumberBE(taggedHash("BIP0340/challenge", ...args)));
}
function schnorrGetPublicKey(privateKey) {
  return schnorrGetExtPubKey(privateKey).bytes;
}
function schnorrSign(message, privateKey, auxRand = randomBytes$1(32)) {
  const m = ensureBytes("message", message);
  const { bytes: px, scalar: d } = schnorrGetExtPubKey(privateKey);
  const a = ensureBytes("auxRand", auxRand, 32);
  const t = numTo32b(d ^ bytesToNumberBE(taggedHash("BIP0340/aux", a)));
  const rand = taggedHash("BIP0340/nonce", t, px, m);
  const k_ = modN(bytesToNumberBE(rand));
  if (k_ === _0n)
    throw new Error("sign failed: k is zero");
  const { bytes: rx, scalar: k } = schnorrGetExtPubKey(k_);
  const e = challenge(rx, px, m);
  const sig = new Uint8Array(64);
  sig.set(rx, 0);
  sig.set(numTo32b(modN(k + e * d)), 32);
  if (!schnorrVerify(sig, m, px))
    throw new Error("sign: Invalid signature produced");
  return sig;
}
function schnorrVerify(signature, message, publicKey) {
  const sig = ensureBytes("signature", signature, 64);
  const m = ensureBytes("message", message);
  const pub = ensureBytes("publicKey", publicKey, 32);
  try {
    const P = lift_x(bytesToNumberBE(pub));
    const r = bytesToNumberBE(sig.subarray(0, 32));
    if (!fe(r))
      return false;
    const s = bytesToNumberBE(sig.subarray(32, 64));
    if (!ge(s))
      return false;
    const e = challenge(numTo32b(r), pointToBytes(P), m);
    const R = GmulAdd(P, s, modN(-e));
    if (!R || !R.hasEvenY() || R.toAffine().x !== r)
      return false;
    return true;
  } catch (error) {
    return false;
  }
}
const schnorr = /* @__PURE__ */ (() => ({
  getPublicKey: schnorrGetPublicKey,
  sign: schnorrSign,
  verify: schnorrVerify,
  utils: {
    randomPrivateKey: secp256k1.utils.randomPrivateKey,
    lift_x,
    pointToBytes,
    numberToBytesBE,
    bytesToNumberBE,
    taggedHash,
    mod
  }
}))();
const crypto = typeof globalThis === "object" && "crypto" in globalThis ? globalThis.crypto : void 0;
/*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
const u8a = (a) => a instanceof Uint8Array;
const createView$1 = (arr) => new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
const rotr$1 = (word, shift) => word << 32 - shift | word >>> shift;
const isLE$1 = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
if (!isLE$1)
  throw new Error("Non little-endian hardware is not supported");
const hexes$1 = Array.from({ length: 256 }, (v, i2) => i2.toString(16).padStart(2, "0"));
function bytesToHex$1(bytes2) {
  if (!u8a(bytes2))
    throw new Error("Uint8Array expected");
  let hex2 = "";
  for (let i2 = 0; i2 < bytes2.length; i2++) {
    hex2 += hexes$1[bytes2[i2]];
  }
  return hex2;
}
function hexToBytes$1(hex2) {
  if (typeof hex2 !== "string")
    throw new Error("hex string expected, got " + typeof hex2);
  const len = hex2.length;
  if (len % 2)
    throw new Error("padded hex string expected, got unpadded hex of length " + len);
  const array = new Uint8Array(len / 2);
  for (let i2 = 0; i2 < array.length; i2++) {
    const j = i2 * 2;
    const hexByte = hex2.slice(j, j + 2);
    const byte = Number.parseInt(hexByte, 16);
    if (Number.isNaN(byte) || byte < 0)
      throw new Error("Invalid byte sequence");
    array[i2] = byte;
  }
  return array;
}
function utf8ToBytes$1(str) {
  if (typeof str !== "string")
    throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
  return new Uint8Array(new TextEncoder().encode(str));
}
function toBytes$1(data) {
  if (typeof data === "string")
    data = utf8ToBytes$1(data);
  if (!u8a(data))
    throw new Error(`expected Uint8Array, got ${typeof data}`);
  return data;
}
function concatBytes(...arrays) {
  const r = new Uint8Array(arrays.reduce((sum, a) => sum + a.length, 0));
  let pad = 0;
  arrays.forEach((a) => {
    if (!u8a(a))
      throw new Error("Uint8Array expected");
    r.set(a, pad);
    pad += a.length;
  });
  return r;
}
let Hash$1 = class Hash2 {
  // Safe version that clones internal state
  clone() {
    return this._cloneInto();
  }
};
function wrapConstructor$1(hashCons) {
  const hashC = (msg) => hashCons().update(toBytes$1(msg)).digest();
  const tmp = hashCons();
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = () => hashCons();
  return hashC;
}
function randomBytes(bytesLength = 32) {
  if (crypto && typeof crypto.getRandomValues === "function") {
    return crypto.getRandomValues(new Uint8Array(bytesLength));
  }
  throw new Error("crypto.getRandomValues must be defined");
}
function number$1(n) {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error(`Wrong positive integer: ${n}`);
}
function bool$1(b) {
  if (typeof b !== "boolean")
    throw new Error(`Expected boolean, not ${b}`);
}
function bytes$2(b, ...lengths) {
  if (!(b instanceof Uint8Array))
    throw new Error("Expected Uint8Array");
  if (lengths.length > 0 && !lengths.includes(b.length))
    throw new Error(`Expected Uint8Array of length ${lengths}, not of length=${b.length}`);
}
function hash(hash2) {
  if (typeof hash2 !== "function" || typeof hash2.create !== "function")
    throw new Error("Hash should be wrapped by utils.wrapConstructor");
  number$1(hash2.outputLen);
  number$1(hash2.blockLen);
}
function exists$1(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function output$1(out, instance) {
  bytes$2(out);
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error(`digestInto() expects output buffer of length at least ${min}`);
  }
}
const assert = {
  number: number$1,
  bool: bool$1,
  bytes: bytes$2,
  hash,
  exists: exists$1,
  output: output$1
};
function setBigUint64$1(view, byteOffset, value, isLE2) {
  if (typeof view.setBigUint64 === "function")
    return view.setBigUint64(byteOffset, value, isLE2);
  const _32n = BigInt(32);
  const _u32_max = BigInt(4294967295);
  const wh = Number(value >> _32n & _u32_max);
  const wl = Number(value & _u32_max);
  const h2 = isLE2 ? 4 : 0;
  const l = isLE2 ? 0 : 4;
  view.setUint32(byteOffset + h2, wh, isLE2);
  view.setUint32(byteOffset + l, wl, isLE2);
}
class SHA22 extends Hash$1 {
  constructor(blockLen, outputLen, padOffset, isLE2) {
    super();
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE2;
    this.finished = false;
    this.length = 0;
    this.pos = 0;
    this.destroyed = false;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView$1(this.buffer);
  }
  update(data) {
    assert.exists(this);
    const { view, buffer, blockLen } = this;
    data = toBytes$1(data);
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView$1(data);
        for (; blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
      }
    }
    this.length += data.length;
    this.roundClean();
    return this;
  }
  digestInto(out) {
    assert.exists(this);
    assert.output(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE: isLE2 } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    this.buffer.subarray(pos).fill(0);
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      pos = 0;
    }
    for (let i2 = pos; i2 < blockLen; i2++)
      buffer[i2] = 0;
    setBigUint64$1(view, blockLen - 8, BigInt(this.length * 8), isLE2);
    this.process(view, 0);
    const oview = createView$1(out);
    const len = this.outputLen;
    if (len % 4)
      throw new Error("_sha2: outputLen should be aligned to 32bit");
    const outLen = len / 4;
    const state = this.get();
    if (outLen > state.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let i2 = 0; i2 < outLen; i2++)
      oview.setUint32(4 * i2, state[i2], isLE2);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneInto(to) {
    to || (to = new this.constructor());
    to.set(...this.get());
    const { blockLen, buffer, length, finished, destroyed, pos } = this;
    to.length = length;
    to.pos = pos;
    to.finished = finished;
    to.destroyed = destroyed;
    if (length % blockLen)
      to.buffer.set(buffer);
    return to;
  }
}
const Chi$1 = (a, b, c) => a & b ^ ~a & c;
const Maj$1 = (a, b, c) => a & b ^ a & c ^ b & c;
const SHA256_K$1 = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
const IV = new Uint32Array([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);
const SHA256_W$1 = new Uint32Array(64);
let SHA256$1 = class SHA2562 extends SHA22 {
  constructor() {
    super(64, 32, 8, false);
    this.A = IV[0] | 0;
    this.B = IV[1] | 0;
    this.C = IV[2] | 0;
    this.D = IV[3] | 0;
    this.E = IV[4] | 0;
    this.F = IV[5] | 0;
    this.G = IV[6] | 0;
    this.H = IV[7] | 0;
  }
  get() {
    const { A, B, C, D, E, F, G, H } = this;
    return [A, B, C, D, E, F, G, H];
  }
  // prettier-ignore
  set(A, B, C, D, E, F, G, H) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D | 0;
    this.E = E | 0;
    this.F = F | 0;
    this.G = G | 0;
    this.H = H | 0;
  }
  process(view, offset) {
    for (let i2 = 0; i2 < 16; i2++, offset += 4)
      SHA256_W$1[i2] = view.getUint32(offset, false);
    for (let i2 = 16; i2 < 64; i2++) {
      const W15 = SHA256_W$1[i2 - 15];
      const W2 = SHA256_W$1[i2 - 2];
      const s0 = rotr$1(W15, 7) ^ rotr$1(W15, 18) ^ W15 >>> 3;
      const s1 = rotr$1(W2, 17) ^ rotr$1(W2, 19) ^ W2 >>> 10;
      SHA256_W$1[i2] = s1 + SHA256_W$1[i2 - 7] + s0 + SHA256_W$1[i2 - 16] | 0;
    }
    let { A, B, C, D, E, F, G, H } = this;
    for (let i2 = 0; i2 < 64; i2++) {
      const sigma1 = rotr$1(E, 6) ^ rotr$1(E, 11) ^ rotr$1(E, 25);
      const T1 = H + sigma1 + Chi$1(E, F, G) + SHA256_K$1[i2] + SHA256_W$1[i2] | 0;
      const sigma0 = rotr$1(A, 2) ^ rotr$1(A, 13) ^ rotr$1(A, 22);
      const T2 = sigma0 + Maj$1(A, B, C) | 0;
      H = G;
      G = F;
      F = E;
      E = D + T1 | 0;
      D = C;
      C = B;
      B = A;
      A = T1 + T2 | 0;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D = D + this.D | 0;
    E = E + this.E | 0;
    F = F + this.F | 0;
    G = G + this.G | 0;
    H = H + this.H | 0;
    this.set(A, B, C, D, E, F, G, H);
  }
  roundClean() {
    SHA256_W$1.fill(0);
  }
  destroy() {
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    this.buffer.fill(0);
  }
};
class SHA224 extends SHA256$1 {
  constructor() {
    super();
    this.A = 3238371032 | 0;
    this.B = 914150663 | 0;
    this.C = 812702999 | 0;
    this.D = 4144912697 | 0;
    this.E = 4290775857 | 0;
    this.F = 1750603025 | 0;
    this.G = 1694076839 | 0;
    this.H = 3204075428 | 0;
    this.outputLen = 28;
  }
}
const sha256$1 = wrapConstructor$1(() => new SHA256$1());
wrapConstructor$1(() => new SHA224());
/*! scure-base - MIT License (c) 2022 Paul Miller (paulmillr.com) */
function assertNumber(n) {
  if (!Number.isSafeInteger(n))
    throw new Error(`Wrong integer: ${n}`);
}
function chain(...args) {
  const wrap = (a, b) => (c) => a(b(c));
  const encode = Array.from(args).reverse().reduce((acc, i2) => acc ? wrap(acc, i2.encode) : i2.encode, void 0);
  const decode2 = args.reduce((acc, i2) => acc ? wrap(acc, i2.decode) : i2.decode, void 0);
  return { encode, decode: decode2 };
}
function alphabet(alphabet2) {
  return {
    encode: (digits) => {
      if (!Array.isArray(digits) || digits.length && typeof digits[0] !== "number")
        throw new Error("alphabet.encode input should be an array of numbers");
      return digits.map((i2) => {
        assertNumber(i2);
        if (i2 < 0 || i2 >= alphabet2.length)
          throw new Error(`Digit index outside alphabet: ${i2} (alphabet: ${alphabet2.length})`);
        return alphabet2[i2];
      });
    },
    decode: (input) => {
      if (!Array.isArray(input) || input.length && typeof input[0] !== "string")
        throw new Error("alphabet.decode input should be array of strings");
      return input.map((letter) => {
        if (typeof letter !== "string")
          throw new Error(`alphabet.decode: not string element=${letter}`);
        const index = alphabet2.indexOf(letter);
        if (index === -1)
          throw new Error(`Unknown letter: "${letter}". Allowed: ${alphabet2}`);
        return index;
      });
    }
  };
}
function join(separator = "") {
  if (typeof separator !== "string")
    throw new Error("join separator should be string");
  return {
    encode: (from) => {
      if (!Array.isArray(from) || from.length && typeof from[0] !== "string")
        throw new Error("join.encode input should be array of strings");
      for (let i2 of from)
        if (typeof i2 !== "string")
          throw new Error(`join.encode: non-string input=${i2}`);
      return from.join(separator);
    },
    decode: (to) => {
      if (typeof to !== "string")
        throw new Error("join.decode input should be string");
      return to.split(separator);
    }
  };
}
function padding(bits, chr = "=") {
  assertNumber(bits);
  if (typeof chr !== "string")
    throw new Error("padding chr should be string");
  return {
    encode(data) {
      if (!Array.isArray(data) || data.length && typeof data[0] !== "string")
        throw new Error("padding.encode input should be array of strings");
      for (let i2 of data)
        if (typeof i2 !== "string")
          throw new Error(`padding.encode: non-string input=${i2}`);
      while (data.length * bits % 8)
        data.push(chr);
      return data;
    },
    decode(input) {
      if (!Array.isArray(input) || input.length && typeof input[0] !== "string")
        throw new Error("padding.encode input should be array of strings");
      for (let i2 of input)
        if (typeof i2 !== "string")
          throw new Error(`padding.decode: non-string input=${i2}`);
      let end = input.length;
      if (end * bits % 8)
        throw new Error("Invalid padding: string should have whole number of bytes");
      for (; end > 0 && input[end - 1] === chr; end--) {
        if (!((end - 1) * bits % 8))
          throw new Error("Invalid padding: string has too much padding");
      }
      return input.slice(0, end);
    }
  };
}
function normalize(fn) {
  if (typeof fn !== "function")
    throw new Error("normalize fn should be function");
  return { encode: (from) => from, decode: (to) => fn(to) };
}
function convertRadix(data, from, to) {
  if (from < 2)
    throw new Error(`convertRadix: wrong from=${from}, base cannot be less than 2`);
  if (to < 2)
    throw new Error(`convertRadix: wrong to=${to}, base cannot be less than 2`);
  if (!Array.isArray(data))
    throw new Error("convertRadix: data should be array");
  if (!data.length)
    return [];
  let pos = 0;
  const res = [];
  const digits = Array.from(data);
  digits.forEach((d) => {
    assertNumber(d);
    if (d < 0 || d >= from)
      throw new Error(`Wrong integer: ${d}`);
  });
  while (true) {
    let carry = 0;
    let done = true;
    for (let i2 = pos; i2 < digits.length; i2++) {
      const digit = digits[i2];
      const digitBase = from * carry + digit;
      if (!Number.isSafeInteger(digitBase) || from * carry / from !== carry || digitBase - digit !== from * carry) {
        throw new Error("convertRadix: carry overflow");
      }
      carry = digitBase % to;
      digits[i2] = Math.floor(digitBase / to);
      if (!Number.isSafeInteger(digits[i2]) || digits[i2] * to + carry !== digitBase)
        throw new Error("convertRadix: carry overflow");
      if (!done)
        continue;
      else if (!digits[i2])
        pos = i2;
      else
        done = false;
    }
    res.push(carry);
    if (done)
      break;
  }
  for (let i2 = 0; i2 < data.length - 1 && data[i2] === 0; i2++)
    res.push(0);
  return res.reverse();
}
const gcd = (a, b) => !b ? a : gcd(b, a % b);
const radix2carry = (from, to) => from + (to - gcd(from, to));
function convertRadix2(data, from, to, padding2) {
  if (!Array.isArray(data))
    throw new Error("convertRadix2: data should be array");
  if (from <= 0 || from > 32)
    throw new Error(`convertRadix2: wrong from=${from}`);
  if (to <= 0 || to > 32)
    throw new Error(`convertRadix2: wrong to=${to}`);
  if (radix2carry(from, to) > 32) {
    throw new Error(`convertRadix2: carry overflow from=${from} to=${to} carryBits=${radix2carry(from, to)}`);
  }
  let carry = 0;
  let pos = 0;
  const mask = 2 ** to - 1;
  const res = [];
  for (const n of data) {
    assertNumber(n);
    if (n >= 2 ** from)
      throw new Error(`convertRadix2: invalid data word=${n} from=${from}`);
    carry = carry << from | n;
    if (pos + from > 32)
      throw new Error(`convertRadix2: carry overflow pos=${pos} from=${from}`);
    pos += from;
    for (; pos >= to; pos -= to)
      res.push((carry >> pos - to & mask) >>> 0);
    carry &= 2 ** pos - 1;
  }
  carry = carry << to - pos & mask;
  if (!padding2 && pos >= from)
    throw new Error("Excess padding");
  if (!padding2 && carry)
    throw new Error(`Non-zero padding: ${carry}`);
  if (padding2 && pos > 0)
    res.push(carry >>> 0);
  return res;
}
function radix(num) {
  assertNumber(num);
  return {
    encode: (bytes2) => {
      if (!(bytes2 instanceof Uint8Array))
        throw new Error("radix.encode input should be Uint8Array");
      return convertRadix(Array.from(bytes2), 2 ** 8, num);
    },
    decode: (digits) => {
      if (!Array.isArray(digits) || digits.length && typeof digits[0] !== "number")
        throw new Error("radix.decode input should be array of strings");
      return Uint8Array.from(convertRadix(digits, num, 2 ** 8));
    }
  };
}
function radix2(bits, revPadding = false) {
  assertNumber(bits);
  if (bits <= 0 || bits > 32)
    throw new Error("radix2: bits should be in (0..32]");
  if (radix2carry(8, bits) > 32 || radix2carry(bits, 8) > 32)
    throw new Error("radix2: carry overflow");
  return {
    encode: (bytes2) => {
      if (!(bytes2 instanceof Uint8Array))
        throw new Error("radix2.encode input should be Uint8Array");
      return convertRadix2(Array.from(bytes2), 8, bits, !revPadding);
    },
    decode: (digits) => {
      if (!Array.isArray(digits) || digits.length && typeof digits[0] !== "number")
        throw new Error("radix2.decode input should be array of strings");
      return Uint8Array.from(convertRadix2(digits, bits, 8, revPadding));
    }
  };
}
function unsafeWrapper(fn) {
  if (typeof fn !== "function")
    throw new Error("unsafeWrapper fn should be function");
  return function(...args) {
    try {
      return fn.apply(null, args);
    } catch (e) {
    }
  };
}
const base16 = chain(radix2(4), alphabet("0123456789ABCDEF"), join(""));
const base32 = chain(radix2(5), alphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"), padding(5), join(""));
chain(radix2(5), alphabet("0123456789ABCDEFGHIJKLMNOPQRSTUV"), padding(5), join(""));
chain(radix2(5), alphabet("0123456789ABCDEFGHJKMNPQRSTVWXYZ"), join(""), normalize((s) => s.toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1")));
const base64 = chain(radix2(6), alphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"), padding(6), join(""));
const base64url = chain(radix2(6), alphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"), padding(6), join(""));
const genBase58 = (abc) => chain(radix(58), alphabet(abc), join(""));
const base58 = genBase58("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz");
genBase58("123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ");
genBase58("rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz");
const XMR_BLOCK_LEN = [0, 2, 3, 5, 6, 7, 9, 10, 11];
const base58xmr = {
  encode(data) {
    let res = "";
    for (let i2 = 0; i2 < data.length; i2 += 8) {
      const block = data.subarray(i2, i2 + 8);
      res += base58.encode(block).padStart(XMR_BLOCK_LEN[block.length], "1");
    }
    return res;
  },
  decode(str) {
    let res = [];
    for (let i2 = 0; i2 < str.length; i2 += 11) {
      const slice = str.slice(i2, i2 + 11);
      const blockLen = XMR_BLOCK_LEN.indexOf(slice.length);
      const block = base58.decode(slice);
      for (let j = 0; j < block.length - blockLen; j++) {
        if (block[j] !== 0)
          throw new Error("base58xmr: wrong padding");
      }
      res = res.concat(Array.from(block.slice(block.length - blockLen)));
    }
    return Uint8Array.from(res);
  }
};
const BECH_ALPHABET = chain(alphabet("qpzry9x8gf2tvdw0s3jn54khce6mua7l"), join(""));
const POLYMOD_GENERATORS = [996825010, 642813549, 513874426, 1027748829, 705979059];
function bech32Polymod(pre) {
  const b = pre >> 25;
  let chk = (pre & 33554431) << 5;
  for (let i2 = 0; i2 < POLYMOD_GENERATORS.length; i2++) {
    if ((b >> i2 & 1) === 1)
      chk ^= POLYMOD_GENERATORS[i2];
  }
  return chk;
}
function bechChecksum(prefix, words, encodingConst = 1) {
  const len = prefix.length;
  let chk = 1;
  for (let i2 = 0; i2 < len; i2++) {
    const c = prefix.charCodeAt(i2);
    if (c < 33 || c > 126)
      throw new Error(`Invalid prefix (${prefix})`);
    chk = bech32Polymod(chk) ^ c >> 5;
  }
  chk = bech32Polymod(chk);
  for (let i2 = 0; i2 < len; i2++)
    chk = bech32Polymod(chk) ^ prefix.charCodeAt(i2) & 31;
  for (let v of words)
    chk = bech32Polymod(chk) ^ v;
  for (let i2 = 0; i2 < 6; i2++)
    chk = bech32Polymod(chk);
  chk ^= encodingConst;
  return BECH_ALPHABET.encode(convertRadix2([chk % 2 ** 30], 30, 5, false));
}
function genBech32(encoding) {
  const ENCODING_CONST = encoding === "bech32" ? 1 : 734539939;
  const _words = radix2(5);
  const fromWords = _words.decode;
  const toWords = _words.encode;
  const fromWordsUnsafe = unsafeWrapper(fromWords);
  function encode(prefix, words, limit = 90) {
    if (typeof prefix !== "string")
      throw new Error(`bech32.encode prefix should be string, not ${typeof prefix}`);
    if (!Array.isArray(words) || words.length && typeof words[0] !== "number")
      throw new Error(`bech32.encode words should be array of numbers, not ${typeof words}`);
    const actualLength = prefix.length + 7 + words.length;
    if (limit !== false && actualLength > limit)
      throw new TypeError(`Length ${actualLength} exceeds limit ${limit}`);
    prefix = prefix.toLowerCase();
    return `${prefix}1${BECH_ALPHABET.encode(words)}${bechChecksum(prefix, words, ENCODING_CONST)}`;
  }
  function decode2(str, limit = 90) {
    if (typeof str !== "string")
      throw new Error(`bech32.decode input should be string, not ${typeof str}`);
    if (str.length < 8 || limit !== false && str.length > limit)
      throw new TypeError(`Wrong string length: ${str.length} (${str}). Expected (8..${limit})`);
    const lowered = str.toLowerCase();
    if (str !== lowered && str !== str.toUpperCase())
      throw new Error(`String must be lowercase or uppercase`);
    str = lowered;
    const sepIndex = str.lastIndexOf("1");
    if (sepIndex === 0 || sepIndex === -1)
      throw new Error(`Letter "1" must be present between prefix and data only`);
    const prefix = str.slice(0, sepIndex);
    const _words2 = str.slice(sepIndex + 1);
    if (_words2.length < 6)
      throw new Error("Data must be at least 6 characters long");
    const words = BECH_ALPHABET.decode(_words2).slice(0, -6);
    const sum = bechChecksum(prefix, words, ENCODING_CONST);
    if (!_words2.endsWith(sum))
      throw new Error(`Invalid checksum in ${str}: expected "${sum}"`);
    return { prefix, words };
  }
  const decodeUnsafe = unsafeWrapper(decode2);
  function decodeToBytes(str) {
    const { prefix, words } = decode2(str, false);
    return { prefix, words, bytes: fromWords(words) };
  }
  return { encode, decode: decode2, decodeToBytes, decodeUnsafe, fromWords, fromWordsUnsafe, toWords };
}
const bech32 = genBech32("bech32");
genBech32("bech32m");
const utf8 = {
  encode: (data) => new TextDecoder().decode(data),
  decode: (str) => new TextEncoder().encode(str)
};
const hex = chain(radix2(4), alphabet("0123456789abcdef"), join(""), normalize((s) => {
  if (typeof s !== "string" || s.length % 2)
    throw new TypeError(`hex.decode: expected string, got ${typeof s} with length ${s.length}`);
  return s.toLowerCase();
}));
const CODERS = {
  utf8,
  hex,
  base16,
  base32,
  base64,
  base64url,
  base58,
  base58xmr
};
`Invalid encoding type. Available types: ${Object.keys(CODERS).join(", ")}`;
function number(n) {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error(`positive integer expected, not ${n}`);
}
function bool(b) {
  if (typeof b !== "boolean")
    throw new Error(`boolean expected, not ${b}`);
}
function isBytes$1(a) {
  return a instanceof Uint8Array || a != null && typeof a === "object" && a.constructor.name === "Uint8Array";
}
function bytes$1(b, ...lengths) {
  if (!isBytes$1(b))
    throw new Error("Uint8Array expected");
  if (lengths.length > 0 && !lengths.includes(b.length))
    throw new Error(`Uint8Array expected of length ${lengths}, not of length=${b.length}`);
}
/*! noble-ciphers - MIT License (c) 2023 Paul Miller (paulmillr.com) */
const u32 = (arr) => new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
const isLE = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
if (!isLE)
  throw new Error("Non little-endian hardware is not supported");
function checkOpts(defaults, opts) {
  if (opts == null || typeof opts !== "object")
    throw new Error("options must be defined");
  const merged = Object.assign(defaults, opts);
  return merged;
}
function equalBytes(a, b) {
  if (a.length !== b.length)
    return false;
  let diff = 0;
  for (let i2 = 0; i2 < a.length; i2++)
    diff |= a[i2] ^ b[i2];
  return diff === 0;
}
const wrapCipher = /* @__NO_SIDE_EFFECTS__ */ (params, c) => {
  Object.assign(c, params);
  return c;
};
const BLOCK_SIZE = 16;
const POLY = 283;
function mul2(n) {
  return n << 1 ^ POLY & -(n >> 7);
}
function mul(a, b) {
  let res = 0;
  for (; b > 0; b >>= 1) {
    res ^= a & -(b & 1);
    a = mul2(a);
  }
  return res;
}
const sbox = /* @__PURE__ */ (() => {
  let t = new Uint8Array(256);
  for (let i2 = 0, x = 1; i2 < 256; i2++, x ^= mul2(x))
    t[i2] = x;
  const box = new Uint8Array(256);
  box[0] = 99;
  for (let i2 = 0; i2 < 255; i2++) {
    let x = t[255 - i2];
    x |= x << 8;
    box[t[i2]] = (x ^ x >> 4 ^ x >> 5 ^ x >> 6 ^ x >> 7 ^ 99) & 255;
  }
  return box;
})();
const invSbox = /* @__PURE__ */ sbox.map((_, j) => sbox.indexOf(j));
const rotr32_8 = (n) => n << 24 | n >>> 8;
const rotl32_8 = (n) => n << 8 | n >>> 24;
function genTtable(sbox2, fn) {
  if (sbox2.length !== 256)
    throw new Error("Wrong sbox length");
  const T0 = new Uint32Array(256).map((_, j) => fn(sbox2[j]));
  const T1 = T0.map(rotl32_8);
  const T2 = T1.map(rotl32_8);
  const T3 = T2.map(rotl32_8);
  const T01 = new Uint32Array(256 * 256);
  const T23 = new Uint32Array(256 * 256);
  const sbox22 = new Uint16Array(256 * 256);
  for (let i2 = 0; i2 < 256; i2++) {
    for (let j = 0; j < 256; j++) {
      const idx = i2 * 256 + j;
      T01[idx] = T0[i2] ^ T1[j];
      T23[idx] = T2[i2] ^ T3[j];
      sbox22[idx] = sbox2[i2] << 8 | sbox2[j];
    }
  }
  return { sbox: sbox2, sbox2: sbox22, T0, T1, T2, T3, T01, T23 };
}
const tableEncoding = /* @__PURE__ */ genTtable(sbox, (s) => mul(s, 3) << 24 | s << 16 | s << 8 | mul(s, 2));
const tableDecoding = /* @__PURE__ */ genTtable(invSbox, (s) => mul(s, 11) << 24 | mul(s, 13) << 16 | mul(s, 9) << 8 | mul(s, 14));
const xPowers = /* @__PURE__ */ (() => {
  const p2 = new Uint8Array(16);
  for (let i2 = 0, x = 1; i2 < 16; i2++, x = mul2(x))
    p2[i2] = x;
  return p2;
})();
function expandKeyLE(key) {
  bytes$1(key);
  const len = key.length;
  if (![16, 24, 32].includes(len))
    throw new Error(`aes: wrong key size: should be 16, 24 or 32, got: ${len}`);
  const { sbox2 } = tableEncoding;
  const k32 = u32(key);
  const Nk = k32.length;
  const subByte = (n) => applySbox(sbox2, n, n, n, n);
  const xk = new Uint32Array(len + 28);
  xk.set(k32);
  for (let i2 = Nk; i2 < xk.length; i2++) {
    let t = xk[i2 - 1];
    if (i2 % Nk === 0)
      t = subByte(rotr32_8(t)) ^ xPowers[i2 / Nk - 1];
    else if (Nk > 6 && i2 % Nk === 4)
      t = subByte(t);
    xk[i2] = xk[i2 - Nk] ^ t;
  }
  return xk;
}
function expandKeyDecLE(key) {
  const encKey = expandKeyLE(key);
  const xk = encKey.slice();
  const Nk = encKey.length;
  const { sbox2 } = tableEncoding;
  const { T0, T1, T2, T3 } = tableDecoding;
  for (let i2 = 0; i2 < Nk; i2 += 4) {
    for (let j = 0; j < 4; j++)
      xk[i2 + j] = encKey[Nk - i2 - 4 + j];
  }
  encKey.fill(0);
  for (let i2 = 4; i2 < Nk - 4; i2++) {
    const x = xk[i2];
    const w = applySbox(sbox2, x, x, x, x);
    xk[i2] = T0[w & 255] ^ T1[w >>> 8 & 255] ^ T2[w >>> 16 & 255] ^ T3[w >>> 24];
  }
  return xk;
}
function apply0123(T01, T23, s0, s1, s2, s3) {
  return T01[s0 << 8 & 65280 | s1 >>> 8 & 255] ^ T23[s2 >>> 8 & 65280 | s3 >>> 24 & 255];
}
function applySbox(sbox2, s0, s1, s2, s3) {
  return sbox2[s0 & 255 | s1 & 65280] | sbox2[s2 >>> 16 & 255 | s3 >>> 16 & 65280] << 16;
}
function encrypt$1(xk, s0, s1, s2, s3) {
  const { sbox2, T01, T23 } = tableEncoding;
  let k = 0;
  s0 ^= xk[k++], s1 ^= xk[k++], s2 ^= xk[k++], s3 ^= xk[k++];
  const rounds = xk.length / 4 - 2;
  for (let i2 = 0; i2 < rounds; i2++) {
    const t02 = xk[k++] ^ apply0123(T01, T23, s0, s1, s2, s3);
    const t12 = xk[k++] ^ apply0123(T01, T23, s1, s2, s3, s0);
    const t22 = xk[k++] ^ apply0123(T01, T23, s2, s3, s0, s1);
    const t32 = xk[k++] ^ apply0123(T01, T23, s3, s0, s1, s2);
    s0 = t02, s1 = t12, s2 = t22, s3 = t32;
  }
  const t0 = xk[k++] ^ applySbox(sbox2, s0, s1, s2, s3);
  const t1 = xk[k++] ^ applySbox(sbox2, s1, s2, s3, s0);
  const t2 = xk[k++] ^ applySbox(sbox2, s2, s3, s0, s1);
  const t3 = xk[k++] ^ applySbox(sbox2, s3, s0, s1, s2);
  return { s0: t0, s1: t1, s2: t2, s3: t3 };
}
function decrypt$1(xk, s0, s1, s2, s3) {
  const { sbox2, T01, T23 } = tableDecoding;
  let k = 0;
  s0 ^= xk[k++], s1 ^= xk[k++], s2 ^= xk[k++], s3 ^= xk[k++];
  const rounds = xk.length / 4 - 2;
  for (let i2 = 0; i2 < rounds; i2++) {
    const t02 = xk[k++] ^ apply0123(T01, T23, s0, s3, s2, s1);
    const t12 = xk[k++] ^ apply0123(T01, T23, s1, s0, s3, s2);
    const t22 = xk[k++] ^ apply0123(T01, T23, s2, s1, s0, s3);
    const t32 = xk[k++] ^ apply0123(T01, T23, s3, s2, s1, s0);
    s0 = t02, s1 = t12, s2 = t22, s3 = t32;
  }
  const t0 = xk[k++] ^ applySbox(sbox2, s0, s3, s2, s1);
  const t1 = xk[k++] ^ applySbox(sbox2, s1, s0, s3, s2);
  const t2 = xk[k++] ^ applySbox(sbox2, s2, s1, s0, s3);
  const t3 = xk[k++] ^ applySbox(sbox2, s3, s2, s1, s0);
  return { s0: t0, s1: t1, s2: t2, s3: t3 };
}
function getDst(len, dst) {
  if (!dst)
    return new Uint8Array(len);
  bytes$1(dst);
  if (dst.length < len)
    throw new Error(`aes: wrong destination length, expected at least ${len}, got: ${dst.length}`);
  return dst;
}
function validateBlockDecrypt(data) {
  bytes$1(data);
  if (data.length % BLOCK_SIZE !== 0) {
    throw new Error(`aes/(cbc-ecb).decrypt ciphertext should consist of blocks with size ${BLOCK_SIZE}`);
  }
}
function validateBlockEncrypt(plaintext, pcks5, dst) {
  let outLen = plaintext.length;
  const remaining = outLen % BLOCK_SIZE;
  if (!pcks5 && remaining !== 0)
    throw new Error("aec/(cbc-ecb): unpadded plaintext with disabled padding");
  const b = u32(plaintext);
  if (pcks5) {
    let left = BLOCK_SIZE - remaining;
    if (!left)
      left = BLOCK_SIZE;
    outLen = outLen + left;
  }
  const out = getDst(outLen, dst);
  const o = u32(out);
  return { b, o, out };
}
function validatePCKS(data, pcks5) {
  if (!pcks5)
    return data;
  const len = data.length;
  if (!len)
    throw new Error(`aes/pcks5: empty ciphertext not allowed`);
  const lastByte = data[len - 1];
  if (lastByte <= 0 || lastByte > 16)
    throw new Error(`aes/pcks5: wrong padding byte: ${lastByte}`);
  const out = data.subarray(0, -lastByte);
  for (let i2 = 0; i2 < lastByte; i2++)
    if (data[len - i2 - 1] !== lastByte)
      throw new Error(`aes/pcks5: wrong padding`);
  return out;
}
function padPCKS(left) {
  const tmp = new Uint8Array(16);
  const tmp32 = u32(tmp);
  tmp.set(left);
  const paddingByte = BLOCK_SIZE - left.length;
  for (let i2 = BLOCK_SIZE - paddingByte; i2 < BLOCK_SIZE; i2++)
    tmp[i2] = paddingByte;
  return tmp32;
}
const cbc = /* @__PURE__ */ wrapCipher({ blockSize: 16, nonceLength: 16 }, function cbc2(key, iv, opts = {}) {
  bytes$1(key);
  bytes$1(iv, 16);
  const pcks5 = !opts.disablePadding;
  return {
    encrypt: (plaintext, dst) => {
      const xk = expandKeyLE(key);
      const { b, o, out: _out } = validateBlockEncrypt(plaintext, pcks5, dst);
      const n32 = u32(iv);
      let s0 = n32[0], s1 = n32[1], s2 = n32[2], s3 = n32[3];
      let i2 = 0;
      for (; i2 + 4 <= b.length; ) {
        s0 ^= b[i2 + 0], s1 ^= b[i2 + 1], s2 ^= b[i2 + 2], s3 ^= b[i2 + 3];
        ({ s0, s1, s2, s3 } = encrypt$1(xk, s0, s1, s2, s3));
        o[i2++] = s0, o[i2++] = s1, o[i2++] = s2, o[i2++] = s3;
      }
      if (pcks5) {
        const tmp32 = padPCKS(plaintext.subarray(i2 * 4));
        s0 ^= tmp32[0], s1 ^= tmp32[1], s2 ^= tmp32[2], s3 ^= tmp32[3];
        ({ s0, s1, s2, s3 } = encrypt$1(xk, s0, s1, s2, s3));
        o[i2++] = s0, o[i2++] = s1, o[i2++] = s2, o[i2++] = s3;
      }
      xk.fill(0);
      return _out;
    },
    decrypt: (ciphertext, dst) => {
      validateBlockDecrypt(ciphertext);
      const xk = expandKeyDecLE(key);
      const n32 = u32(iv);
      const out = getDst(ciphertext.length, dst);
      const b = u32(ciphertext);
      const o = u32(out);
      let s0 = n32[0], s1 = n32[1], s2 = n32[2], s3 = n32[3];
      for (let i2 = 0; i2 + 4 <= b.length; ) {
        const ps0 = s0, ps1 = s1, ps2 = s2, ps3 = s3;
        s0 = b[i2 + 0], s1 = b[i2 + 1], s2 = b[i2 + 2], s3 = b[i2 + 3];
        const { s0: o0, s1: o1, s2: o2, s3: o3 } = decrypt$1(xk, s0, s1, s2, s3);
        o[i2++] = o0 ^ ps0, o[i2++] = o1 ^ ps1, o[i2++] = o2 ^ ps2, o[i2++] = o3 ^ ps3;
      }
      xk.fill(0);
      return validatePCKS(out, pcks5);
    }
  };
});
const _utf8ToBytes = (str) => Uint8Array.from(str.split("").map((c) => c.charCodeAt(0)));
const sigma16 = _utf8ToBytes("expand 16-byte k");
const sigma32 = _utf8ToBytes("expand 32-byte k");
const sigma16_32 = u32(sigma16);
const sigma32_32 = u32(sigma32);
sigma32_32.slice();
function rotl(a, b) {
  return a << b | a >>> 32 - b;
}
function isAligned32(b) {
  return b.byteOffset % 4 === 0;
}
const BLOCK_LEN = 64;
const BLOCK_LEN32 = 16;
const MAX_COUNTER = 2 ** 32 - 1;
const U32_EMPTY = new Uint32Array();
function runCipher(core, sigma, key, nonce, data, output2, counter, rounds) {
  const len = data.length;
  const block = new Uint8Array(BLOCK_LEN);
  const b32 = u32(block);
  const isAligned = isAligned32(data) && isAligned32(output2);
  const d32 = isAligned ? u32(data) : U32_EMPTY;
  const o32 = isAligned ? u32(output2) : U32_EMPTY;
  for (let pos = 0; pos < len; counter++) {
    core(sigma, key, nonce, b32, counter, rounds);
    if (counter >= MAX_COUNTER)
      throw new Error("arx: counter overflow");
    const take = Math.min(BLOCK_LEN, len - pos);
    if (isAligned && take === BLOCK_LEN) {
      const pos32 = pos / 4;
      if (pos % 4 !== 0)
        throw new Error("arx: invalid block position");
      for (let j = 0, posj; j < BLOCK_LEN32; j++) {
        posj = pos32 + j;
        o32[posj] = d32[posj] ^ b32[j];
      }
      pos += BLOCK_LEN;
      continue;
    }
    for (let j = 0, posj; j < take; j++) {
      posj = pos + j;
      output2[posj] = data[posj] ^ block[j];
    }
    pos += take;
  }
}
function createCipher(core, opts) {
  const { allowShortKeys, extendNonceFn, counterLength, counterRight, rounds } = checkOpts({ allowShortKeys: false, counterLength: 8, counterRight: false, rounds: 20 }, opts);
  if (typeof core !== "function")
    throw new Error("core must be a function");
  number(counterLength);
  number(rounds);
  bool(counterRight);
  bool(allowShortKeys);
  return (key, nonce, data, output2, counter = 0) => {
    bytes$1(key);
    bytes$1(nonce);
    bytes$1(data);
    const len = data.length;
    if (!output2)
      output2 = new Uint8Array(len);
    bytes$1(output2);
    number(counter);
    if (counter < 0 || counter >= MAX_COUNTER)
      throw new Error("arx: counter overflow");
    if (output2.length < len)
      throw new Error(`arx: output (${output2.length}) is shorter than data (${len})`);
    const toClean = [];
    let l = key.length, k, sigma;
    if (l === 32) {
      k = key.slice();
      toClean.push(k);
      sigma = sigma32_32;
    } else if (l === 16 && allowShortKeys) {
      k = new Uint8Array(32);
      k.set(key);
      k.set(key, 16);
      sigma = sigma16_32;
      toClean.push(k);
    } else {
      throw new Error(`arx: invalid 32-byte key, got length=${l}`);
    }
    if (!isAligned32(nonce)) {
      nonce = nonce.slice();
      toClean.push(nonce);
    }
    const k32 = u32(k);
    if (extendNonceFn) {
      if (nonce.length !== 24)
        throw new Error(`arx: extended nonce must be 24 bytes`);
      extendNonceFn(sigma, k32, u32(nonce.subarray(0, 16)), k32);
      nonce = nonce.subarray(16);
    }
    const nonceNcLen = 16 - counterLength;
    if (nonceNcLen !== nonce.length)
      throw new Error(`arx: nonce must be ${nonceNcLen} or 16 bytes`);
    if (nonceNcLen !== 12) {
      const nc = new Uint8Array(12);
      nc.set(nonce, counterRight ? 0 : 12 - nonce.length);
      nonce = nc;
      toClean.push(nonce);
    }
    const n32 = u32(nonce);
    runCipher(core, sigma, k32, n32, data, output2, counter, rounds);
    while (toClean.length > 0)
      toClean.pop().fill(0);
    return output2;
  };
}
function chachaCore(s, k, n, out, cnt, rounds = 20) {
  let y00 = s[0], y01 = s[1], y02 = s[2], y03 = s[3], y04 = k[0], y05 = k[1], y06 = k[2], y07 = k[3], y08 = k[4], y09 = k[5], y10 = k[6], y11 = k[7], y12 = cnt, y13 = n[0], y14 = n[1], y15 = n[2];
  let x00 = y00, x01 = y01, x02 = y02, x03 = y03, x04 = y04, x05 = y05, x06 = y06, x07 = y07, x08 = y08, x09 = y09, x10 = y10, x11 = y11, x12 = y12, x13 = y13, x14 = y14, x15 = y15;
  for (let r = 0; r < rounds; r += 2) {
    x00 = x00 + x04 | 0;
    x12 = rotl(x12 ^ x00, 16);
    x08 = x08 + x12 | 0;
    x04 = rotl(x04 ^ x08, 12);
    x00 = x00 + x04 | 0;
    x12 = rotl(x12 ^ x00, 8);
    x08 = x08 + x12 | 0;
    x04 = rotl(x04 ^ x08, 7);
    x01 = x01 + x05 | 0;
    x13 = rotl(x13 ^ x01, 16);
    x09 = x09 + x13 | 0;
    x05 = rotl(x05 ^ x09, 12);
    x01 = x01 + x05 | 0;
    x13 = rotl(x13 ^ x01, 8);
    x09 = x09 + x13 | 0;
    x05 = rotl(x05 ^ x09, 7);
    x02 = x02 + x06 | 0;
    x14 = rotl(x14 ^ x02, 16);
    x10 = x10 + x14 | 0;
    x06 = rotl(x06 ^ x10, 12);
    x02 = x02 + x06 | 0;
    x14 = rotl(x14 ^ x02, 8);
    x10 = x10 + x14 | 0;
    x06 = rotl(x06 ^ x10, 7);
    x03 = x03 + x07 | 0;
    x15 = rotl(x15 ^ x03, 16);
    x11 = x11 + x15 | 0;
    x07 = rotl(x07 ^ x11, 12);
    x03 = x03 + x07 | 0;
    x15 = rotl(x15 ^ x03, 8);
    x11 = x11 + x15 | 0;
    x07 = rotl(x07 ^ x11, 7);
    x00 = x00 + x05 | 0;
    x15 = rotl(x15 ^ x00, 16);
    x10 = x10 + x15 | 0;
    x05 = rotl(x05 ^ x10, 12);
    x00 = x00 + x05 | 0;
    x15 = rotl(x15 ^ x00, 8);
    x10 = x10 + x15 | 0;
    x05 = rotl(x05 ^ x10, 7);
    x01 = x01 + x06 | 0;
    x12 = rotl(x12 ^ x01, 16);
    x11 = x11 + x12 | 0;
    x06 = rotl(x06 ^ x11, 12);
    x01 = x01 + x06 | 0;
    x12 = rotl(x12 ^ x01, 8);
    x11 = x11 + x12 | 0;
    x06 = rotl(x06 ^ x11, 7);
    x02 = x02 + x07 | 0;
    x13 = rotl(x13 ^ x02, 16);
    x08 = x08 + x13 | 0;
    x07 = rotl(x07 ^ x08, 12);
    x02 = x02 + x07 | 0;
    x13 = rotl(x13 ^ x02, 8);
    x08 = x08 + x13 | 0;
    x07 = rotl(x07 ^ x08, 7);
    x03 = x03 + x04 | 0;
    x14 = rotl(x14 ^ x03, 16);
    x09 = x09 + x14 | 0;
    x04 = rotl(x04 ^ x09, 12);
    x03 = x03 + x04 | 0;
    x14 = rotl(x14 ^ x03, 8);
    x09 = x09 + x14 | 0;
    x04 = rotl(x04 ^ x09, 7);
  }
  let oi = 0;
  out[oi++] = y00 + x00 | 0;
  out[oi++] = y01 + x01 | 0;
  out[oi++] = y02 + x02 | 0;
  out[oi++] = y03 + x03 | 0;
  out[oi++] = y04 + x04 | 0;
  out[oi++] = y05 + x05 | 0;
  out[oi++] = y06 + x06 | 0;
  out[oi++] = y07 + x07 | 0;
  out[oi++] = y08 + x08 | 0;
  out[oi++] = y09 + x09 | 0;
  out[oi++] = y10 + x10 | 0;
  out[oi++] = y11 + x11 | 0;
  out[oi++] = y12 + x12 | 0;
  out[oi++] = y13 + x13 | 0;
  out[oi++] = y14 + x14 | 0;
  out[oi++] = y15 + x15 | 0;
}
const chacha20 = /* @__PURE__ */ createCipher(chachaCore, {
  counterRight: false,
  counterLength: 4,
  allowShortKeys: false
});
class HMAC2 extends Hash$1 {
  constructor(hash2, _key) {
    super();
    this.finished = false;
    this.destroyed = false;
    assert.hash(hash2);
    const key = toBytes$1(_key);
    this.iHash = hash2.create();
    if (typeof this.iHash.update !== "function")
      throw new Error("Expected instance of class which extends utils.Hash");
    this.blockLen = this.iHash.blockLen;
    this.outputLen = this.iHash.outputLen;
    const blockLen = this.blockLen;
    const pad = new Uint8Array(blockLen);
    pad.set(key.length > blockLen ? hash2.create().update(key).digest() : key);
    for (let i2 = 0; i2 < pad.length; i2++)
      pad[i2] ^= 54;
    this.iHash.update(pad);
    this.oHash = hash2.create();
    for (let i2 = 0; i2 < pad.length; i2++)
      pad[i2] ^= 54 ^ 92;
    this.oHash.update(pad);
    pad.fill(0);
  }
  update(buf) {
    assert.exists(this);
    this.iHash.update(buf);
    return this;
  }
  digestInto(out) {
    assert.exists(this);
    assert.bytes(out, this.outputLen);
    this.finished = true;
    this.iHash.digestInto(out);
    this.oHash.update(out);
    this.oHash.digestInto(out);
    this.destroy();
  }
  digest() {
    const out = new Uint8Array(this.oHash.outputLen);
    this.digestInto(out);
    return out;
  }
  _cloneInto(to) {
    to || (to = Object.create(Object.getPrototypeOf(this), {}));
    const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
    to = to;
    to.finished = finished;
    to.destroyed = destroyed;
    to.blockLen = blockLen;
    to.outputLen = outputLen;
    to.oHash = oHash._cloneInto(to.oHash);
    to.iHash = iHash._cloneInto(to.iHash);
    return to;
  }
  destroy() {
    this.destroyed = true;
    this.oHash.destroy();
    this.iHash.destroy();
  }
}
const hmac = (hash2, key, message) => new HMAC2(hash2, key).update(message).digest();
hmac.create = (hash2, key) => new HMAC2(hash2, key);
function extract(hash2, ikm, salt) {
  assert.hash(hash2);
  if (salt === void 0)
    salt = new Uint8Array(hash2.outputLen);
  return hmac(hash2, toBytes$1(salt), toBytes$1(ikm));
}
const HKDF_COUNTER = new Uint8Array([0]);
const EMPTY_BUFFER = new Uint8Array();
function expand(hash2, prk, info, length = 32) {
  assert.hash(hash2);
  assert.number(length);
  if (length > 255 * hash2.outputLen)
    throw new Error("Length should be <= 255*HashLen");
  const blocks = Math.ceil(length / hash2.outputLen);
  if (info === void 0)
    info = EMPTY_BUFFER;
  const okm = new Uint8Array(blocks * hash2.outputLen);
  const HMAC3 = hmac.create(hash2, prk);
  const HMACTmp = HMAC3._cloneInto();
  const T = new Uint8Array(HMAC3.outputLen);
  for (let counter = 0; counter < blocks; counter++) {
    HKDF_COUNTER[0] = counter + 1;
    HMACTmp.update(counter === 0 ? EMPTY_BUFFER : T).update(info).update(HKDF_COUNTER).digestInto(T);
    okm.set(T, hash2.outputLen * counter);
    HMAC3._cloneInto(HMACTmp);
  }
  HMAC3.destroy();
  HMACTmp.destroy();
  T.fill(0);
  HKDF_COUNTER.fill(0);
  return okm.slice(0, length);
}
var __defProp2 = Object.defineProperty;
var __defNormalProp2 = (obj, key, value) => key in obj ? __defProp2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp2(target, name, { get: all[name], enumerable: true });
};
var __publicField2 = (obj, key, value) => {
  __defNormalProp2(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
var verifiedSymbol = Symbol("verified");
var isRecord = (obj) => obj instanceof Object;
function validateEvent(event) {
  if (!isRecord(event))
    return false;
  if (typeof event.kind !== "number")
    return false;
  if (typeof event.content !== "string")
    return false;
  if (typeof event.created_at !== "number")
    return false;
  if (typeof event.pubkey !== "string")
    return false;
  if (!event.pubkey.match(/^[a-f0-9]{64}$/))
    return false;
  if (!Array.isArray(event.tags))
    return false;
  for (let i2 = 0; i2 < event.tags.length; i2++) {
    let tag = event.tags[i2];
    if (!Array.isArray(tag))
      return false;
    for (let j = 0; j < tag.length; j++) {
      if (typeof tag[j] === "object")
        return false;
    }
  }
  return true;
}
var utils_exports = {};
__export(utils_exports, {
  Queue: () => Queue,
  QueueNode: () => QueueNode,
  binarySearch: () => binarySearch,
  insertEventIntoAscendingList: () => insertEventIntoAscendingList,
  insertEventIntoDescendingList: () => insertEventIntoDescendingList,
  normalizeURL: () => normalizeURL$2,
  utf8Decoder: () => utf8Decoder,
  utf8Encoder: () => utf8Encoder
});
var utf8Decoder = new TextDecoder("utf-8");
var utf8Encoder = new TextEncoder();
function normalizeURL$2(url) {
  if (url.indexOf("://") === -1)
    url = "wss://" + url;
  let p2 = new URL(url);
  p2.pathname = p2.pathname.replace(/\/+/g, "/");
  if (p2.pathname.endsWith("/"))
    p2.pathname = p2.pathname.slice(0, -1);
  if (p2.port === "80" && p2.protocol === "ws:" || p2.port === "443" && p2.protocol === "wss:")
    p2.port = "";
  p2.searchParams.sort();
  p2.hash = "";
  return p2.toString();
}
function insertEventIntoDescendingList(sortedArray, event) {
  const [idx, found] = binarySearch(sortedArray, (b) => {
    if (event.id === b.id)
      return 0;
    if (event.created_at === b.created_at)
      return -1;
    return b.created_at - event.created_at;
  });
  if (!found) {
    sortedArray.splice(idx, 0, event);
  }
  return sortedArray;
}
function insertEventIntoAscendingList(sortedArray, event) {
  const [idx, found] = binarySearch(sortedArray, (b) => {
    if (event.id === b.id)
      return 0;
    if (event.created_at === b.created_at)
      return -1;
    return event.created_at - b.created_at;
  });
  if (!found) {
    sortedArray.splice(idx, 0, event);
  }
  return sortedArray;
}
function binarySearch(arr, compare) {
  let start = 0;
  let end = arr.length - 1;
  while (start <= end) {
    const mid = Math.floor((start + end) / 2);
    const cmp = compare(arr[mid]);
    if (cmp === 0) {
      return [mid, true];
    }
    if (cmp < 0) {
      end = mid - 1;
    } else {
      start = mid + 1;
    }
  }
  return [start, false];
}
var QueueNode = class {
  constructor(message) {
    __publicField(this, "value");
    __publicField(this, "next", null);
    __publicField(this, "prev", null);
    this.value = message;
  }
};
var Queue = class {
  constructor() {
    __publicField(this, "first");
    __publicField(this, "last");
    this.first = null;
    this.last = null;
  }
  enqueue(value) {
    const newNode = new QueueNode(value);
    if (!this.last) {
      this.first = newNode;
      this.last = newNode;
    } else if (this.last === this.first) {
      this.last = newNode;
      this.last.prev = this.first;
      this.first.next = newNode;
    } else {
      newNode.prev = this.last;
      this.last.next = newNode;
      this.last = newNode;
    }
    return true;
  }
  dequeue() {
    if (!this.first)
      return null;
    if (this.first === this.last) {
      const target2 = this.first;
      this.first = null;
      this.last = null;
      return target2.value;
    }
    const target = this.first;
    this.first = target.next;
    return target.value;
  }
};
var JS = class {
  generateSecretKey() {
    return schnorr.utils.randomPrivateKey();
  }
  getPublicKey(secretKey) {
    return bytesToHex$1(schnorr.getPublicKey(secretKey));
  }
  finalizeEvent(t, secretKey) {
    const event = t;
    event.pubkey = bytesToHex$1(schnorr.getPublicKey(secretKey));
    event.id = getEventHash(event);
    event.sig = bytesToHex$1(schnorr.sign(getEventHash(event), secretKey));
    event[verifiedSymbol] = true;
    return event;
  }
  verifyEvent(event) {
    if (typeof event[verifiedSymbol] === "boolean")
      return event[verifiedSymbol];
    const hash2 = getEventHash(event);
    if (hash2 !== event.id) {
      event[verifiedSymbol] = false;
      return false;
    }
    try {
      const valid = schnorr.verify(event.sig, hash2, event.pubkey);
      event[verifiedSymbol] = valid;
      return valid;
    } catch (err) {
      event[verifiedSymbol] = false;
      return false;
    }
  }
};
function serializeEvent(evt) {
  if (!validateEvent(evt))
    throw new Error("can't serialize event with wrong or missing properties");
  return JSON.stringify([0, evt.pubkey, evt.created_at, evt.kind, evt.tags, evt.content]);
}
function getEventHash(event) {
  let eventHash = sha256$1(utf8Encoder.encode(serializeEvent(event)));
  return bytesToHex$1(eventHash);
}
var i = new JS();
var generateSecretKey = i.generateSecretKey;
var getPublicKey = i.getPublicKey;
var finalizeEvent = i.finalizeEvent;
var verifyEvent = i.verifyEvent;
var kinds_exports = {};
__export(kinds_exports, {
  Application: () => Application,
  BadgeAward: () => BadgeAward,
  BadgeDefinition: () => BadgeDefinition,
  BlockedRelaysList: () => BlockedRelaysList,
  BookmarkList: () => BookmarkList,
  Bookmarksets: () => Bookmarksets,
  Calendar: () => Calendar,
  CalendarEventRSVP: () => CalendarEventRSVP,
  ChannelCreation: () => ChannelCreation,
  ChannelHideMessage: () => ChannelHideMessage,
  ChannelMessage: () => ChannelMessage,
  ChannelMetadata: () => ChannelMetadata,
  ChannelMuteUser: () => ChannelMuteUser,
  ClassifiedListing: () => ClassifiedListing,
  ClientAuth: () => ClientAuth,
  CommunitiesList: () => CommunitiesList,
  CommunityDefinition: () => CommunityDefinition,
  CommunityPostApproval: () => CommunityPostApproval,
  Contacts: () => Contacts,
  CreateOrUpdateProduct: () => CreateOrUpdateProduct,
  CreateOrUpdateStall: () => CreateOrUpdateStall,
  Curationsets: () => Curationsets,
  Date: () => Date2,
  DraftClassifiedListing: () => DraftClassifiedListing,
  DraftLong: () => DraftLong,
  Emojisets: () => Emojisets,
  EncryptedDirectMessage: () => EncryptedDirectMessage,
  EncryptedDirectMessages: () => EncryptedDirectMessages,
  EventDeletion: () => EventDeletion,
  FileMetadata: () => FileMetadata,
  FileServerPreference: () => FileServerPreference,
  Followsets: () => Followsets,
  GenericRepost: () => GenericRepost,
  Genericlists: () => Genericlists,
  HTTPAuth: () => HTTPAuth,
  Handlerinformation: () => Handlerinformation,
  Handlerrecommendation: () => Handlerrecommendation,
  Highlights: () => Highlights,
  InterestsList: () => InterestsList,
  Interestsets: () => Interestsets,
  JobFeedback: () => JobFeedback,
  JobRequest: () => JobRequest,
  JobResult: () => JobResult,
  Label: () => Label,
  LightningPubRPC: () => LightningPubRPC,
  LiveChatMessage: () => LiveChatMessage,
  LiveEvent: () => LiveEvent,
  LongFormArticle: () => LongFormArticle,
  Metadata: () => Metadata,
  Mutelist: () => Mutelist,
  NWCWalletInfo: () => NWCWalletInfo,
  NWCWalletRequest: () => NWCWalletRequest,
  NWCWalletResponse: () => NWCWalletResponse,
  NostrConnect: () => NostrConnect,
  OpenTimestamps: () => OpenTimestamps,
  Pinlist: () => Pinlist,
  ProblemTracker: () => ProblemTracker,
  ProfileBadges: () => ProfileBadges,
  PublicChatsList: () => PublicChatsList,
  Reaction: () => Reaction,
  RecommendRelay: () => RecommendRelay,
  RelayList: () => RelayList,
  Relaysets: () => Relaysets,
  Report: () => Report,
  Reporting: () => Reporting,
  Repost: () => Repost,
  SearchRelaysList: () => SearchRelaysList,
  ShortTextNote: () => ShortTextNote,
  Time: () => Time,
  UserEmojiList: () => UserEmojiList,
  UserStatuses: () => UserStatuses,
  Zap: () => Zap,
  ZapGoal: () => ZapGoal,
  ZapRequest: () => ZapRequest,
  classifyKind: () => classifyKind,
  isEphemeralKind: () => isEphemeralKind,
  isParameterizedReplaceableKind: () => isParameterizedReplaceableKind,
  isRegularKind: () => isRegularKind,
  isReplaceableKind: () => isReplaceableKind
});
function isRegularKind(kind) {
  return 1e3 <= kind && kind < 1e4 || [1, 2, 4, 5, 6, 7, 8, 16, 40, 41, 42, 43, 44].includes(kind);
}
function isReplaceableKind(kind) {
  return [0, 3].includes(kind) || 1e4 <= kind && kind < 2e4;
}
function isEphemeralKind(kind) {
  return 2e4 <= kind && kind < 3e4;
}
function isParameterizedReplaceableKind(kind) {
  return 3e4 <= kind && kind < 4e4;
}
function classifyKind(kind) {
  if (isRegularKind(kind))
    return "regular";
  if (isReplaceableKind(kind))
    return "replaceable";
  if (isEphemeralKind(kind))
    return "ephemeral";
  if (isParameterizedReplaceableKind(kind))
    return "parameterized";
  return "unknown";
}
var Metadata = 0;
var ShortTextNote = 1;
var RecommendRelay = 2;
var Contacts = 3;
var EncryptedDirectMessage = 4;
var EncryptedDirectMessages = 4;
var EventDeletion = 5;
var Repost = 6;
var Reaction = 7;
var BadgeAward = 8;
var GenericRepost = 16;
var ChannelCreation = 40;
var ChannelMetadata = 41;
var ChannelMessage = 42;
var ChannelHideMessage = 43;
var ChannelMuteUser = 44;
var OpenTimestamps = 1040;
var FileMetadata = 1063;
var LiveChatMessage = 1311;
var ProblemTracker = 1971;
var Report = 1984;
var Reporting = 1984;
var Label = 1985;
var CommunityPostApproval = 4550;
var JobRequest = 5999;
var JobResult = 6999;
var JobFeedback = 7e3;
var ZapGoal = 9041;
var ZapRequest = 9734;
var Zap = 9735;
var Highlights = 9802;
var Mutelist = 1e4;
var Pinlist = 10001;
var RelayList = 10002;
var BookmarkList = 10003;
var CommunitiesList = 10004;
var PublicChatsList = 10005;
var BlockedRelaysList = 10006;
var SearchRelaysList = 10007;
var InterestsList = 10015;
var UserEmojiList = 10030;
var FileServerPreference = 10096;
var NWCWalletInfo = 13194;
var LightningPubRPC = 21e3;
var ClientAuth = 22242;
var NWCWalletRequest = 23194;
var NWCWalletResponse = 23195;
var NostrConnect = 24133;
var HTTPAuth = 27235;
var Followsets = 3e4;
var Genericlists = 30001;
var Relaysets = 30002;
var Bookmarksets = 30003;
var Curationsets = 30004;
var ProfileBadges = 30008;
var BadgeDefinition = 30009;
var Interestsets = 30015;
var CreateOrUpdateStall = 30017;
var CreateOrUpdateProduct = 30018;
var LongFormArticle = 30023;
var DraftLong = 30024;
var Emojisets = 30030;
var Application = 30078;
var LiveEvent = 30311;
var UserStatuses = 30315;
var ClassifiedListing = 30402;
var DraftClassifiedListing = 30403;
var Date2 = 31922;
var Time = 31923;
var Calendar = 31924;
var CalendarEventRSVP = 31925;
var Handlerrecommendation = 31989;
var Handlerinformation = 31990;
var CommunityDefinition = 34550;
function matchFilter(filter, event) {
  if (filter.ids && filter.ids.indexOf(event.id) === -1) {
    if (!filter.ids.some((prefix) => event.id.startsWith(prefix))) {
      return false;
    }
  }
  if (filter.kinds && filter.kinds.indexOf(event.kind) === -1)
    return false;
  if (filter.authors && filter.authors.indexOf(event.pubkey) === -1) {
    if (!filter.authors.some((prefix) => event.pubkey.startsWith(prefix))) {
      return false;
    }
  }
  for (let f in filter) {
    if (f[0] === "#") {
      let tagName = f.slice(1);
      let values = filter[`#${tagName}`];
      if (values && !event.tags.find(([t, v]) => t === f.slice(1) && values.indexOf(v) !== -1))
        return false;
    }
  }
  if (filter.since && event.created_at < filter.since)
    return false;
  if (filter.until && event.created_at > filter.until)
    return false;
  return true;
}
function matchFilters(filters, event) {
  for (let i2 = 0; i2 < filters.length; i2++) {
    if (matchFilter(filters[i2], event)) {
      return true;
    }
  }
  return false;
}
var fakejson_exports = {};
__export(fakejson_exports, {
  getHex64: () => getHex64,
  getInt: () => getInt,
  getSubscriptionId: () => getSubscriptionId,
  matchEventId: () => matchEventId,
  matchEventKind: () => matchEventKind,
  matchEventPubkey: () => matchEventPubkey
});
function getHex64(json, field) {
  let len = field.length + 3;
  let idx = json.indexOf(`"${field}":`) + len;
  let s = json.slice(idx).indexOf(`"`) + idx + 1;
  return json.slice(s, s + 64);
}
function getInt(json, field) {
  let len = field.length;
  let idx = json.indexOf(`"${field}":`) + len + 3;
  let sliced = json.slice(idx);
  let end = Math.min(sliced.indexOf(","), sliced.indexOf("}"));
  return parseInt(sliced.slice(0, end), 10);
}
function getSubscriptionId(json) {
  let idx = json.slice(0, 22).indexOf(`"EVENT"`);
  if (idx === -1)
    return null;
  let pstart = json.slice(idx + 7 + 1).indexOf(`"`);
  if (pstart === -1)
    return null;
  let start = idx + 7 + 1 + pstart;
  let pend = json.slice(start + 1, 80).indexOf(`"`);
  if (pend === -1)
    return null;
  let end = start + 1 + pend;
  return json.slice(start + 1, end);
}
function matchEventId(json, id) {
  return id === getHex64(json, "id");
}
function matchEventPubkey(json, pubkey) {
  return pubkey === getHex64(json, "pubkey");
}
function matchEventKind(json, kind) {
  return kind === getInt(json, "kind");
}
var nip42_exports = {};
__export(nip42_exports, {
  makeAuthEvent: () => makeAuthEvent
});
function makeAuthEvent(relayURL, challenge2) {
  return {
    kind: ClientAuth,
    created_at: Math.floor(Date.now() / 1e3),
    tags: [
      ["relay", relayURL],
      ["challenge", challenge2]
    ],
    content: ""
  };
}
async function yieldThread() {
  return new Promise((resolve2) => {
    const ch = new MessageChannel();
    const handler = () => {
      ch.port1.removeEventListener("message", handler);
      resolve2();
    };
    ch.port1.addEventListener("message", handler);
    ch.port2.postMessage(0);
    ch.port1.start();
  });
}
var alwaysTrue = (t) => {
  t[verifiedSymbol] = true;
  return true;
};
var _WebSocket;
try {
  _WebSocket = WebSocket;
} catch {
}
var AbstractRelay = class {
  constructor(url, opts) {
    __publicField(this, "url");
    __publicField(this, "_connected", false);
    __publicField(this, "onclose", null);
    __publicField(this, "onnotice", (msg) => console.debug(`NOTICE from ${this.url}: ${msg}`));
    __publicField(this, "_onauth", null);
    __publicField(this, "baseEoseTimeout", 4400);
    __publicField(this, "connectionTimeout", 4400);
    __publicField(this, "openSubs", /* @__PURE__ */ new Map());
    __publicField(this, "connectionTimeoutHandle");
    __publicField(this, "connectionPromise");
    __publicField(this, "openCountRequests", /* @__PURE__ */ new Map());
    __publicField(this, "openEventPublishes", /* @__PURE__ */ new Map());
    __publicField(this, "ws");
    __publicField(this, "incomingMessageQueue", new Queue());
    __publicField(this, "queueRunning", false);
    __publicField(this, "challenge");
    __publicField(this, "serial", 0);
    __publicField(this, "verifyEvent");
    this.url = normalizeURL$2(url);
    this.verifyEvent = opts.verifyEvent;
  }
  static async connect(url, opts) {
    const relay = new AbstractRelay(url, opts);
    await relay.connect();
    return relay;
  }
  closeAllSubscriptions(reason) {
    for (let [_, sub] of this.openSubs) {
      sub.close(reason);
    }
    this.openSubs.clear();
    for (let [_, ep] of this.openEventPublishes) {
      ep.reject(new Error(reason));
    }
    this.openEventPublishes.clear();
    for (let [_, cr] of this.openCountRequests) {
      cr.reject(new Error(reason));
    }
    this.openCountRequests.clear();
  }
  get connected() {
    return this._connected;
  }
  async connect() {
    if (this.connectionPromise)
      return this.connectionPromise;
    this.challenge = void 0;
    this.connectionPromise = new Promise((resolve2, reject) => {
      this.connectionTimeoutHandle = setTimeout(() => {
        var _a;
        reject("connection timed out");
        this.connectionPromise = void 0;
        (_a = this.onclose) == null ? void 0 : _a.call(this);
        this.closeAllSubscriptions("relay connection timed out");
      }, this.connectionTimeout);
      try {
        this.ws = new _WebSocket(this.url);
      } catch (err) {
        reject(err);
        return;
      }
      this.ws.onopen = () => {
        clearTimeout(this.connectionTimeoutHandle);
        this._connected = true;
        resolve2();
      };
      this.ws.onerror = (ev) => {
        var _a;
        reject(ev.message);
        if (this._connected) {
          this._connected = false;
          this.connectionPromise = void 0;
          (_a = this.onclose) == null ? void 0 : _a.call(this);
          this.closeAllSubscriptions("relay connection errored");
        }
      };
      this.ws.onclose = async () => {
        var _a;
        if (this._connected) {
          this._connected = false;
          this.connectionPromise = void 0;
          (_a = this.onclose) == null ? void 0 : _a.call(this);
          this.closeAllSubscriptions("relay connection closed");
        }
      };
      this.ws.onmessage = this._onmessage.bind(this);
    });
    return this.connectionPromise;
  }
  async runQueue() {
    this.queueRunning = true;
    while (true) {
      if (false === this.handleNext()) {
        break;
      }
      await yieldThread();
    }
    this.queueRunning = false;
  }
  handleNext() {
    var _a, _b, _c;
    const json = this.incomingMessageQueue.dequeue();
    if (!json) {
      return false;
    }
    const subid = getSubscriptionId(json);
    if (subid) {
      const so = this.openSubs.get(subid);
      if (!so) {
        return;
      }
      const id = getHex64(json, "id");
      const alreadyHave = (_a = so.alreadyHaveEvent) == null ? void 0 : _a.call(so, id);
      (_b = so.receivedEvent) == null ? void 0 : _b.call(so, this, id);
      if (alreadyHave) {
        return;
      }
    }
    try {
      let data = JSON.parse(json);
      switch (data[0]) {
        case "EVENT": {
          const so = this.openSubs.get(data[1]);
          const event = data[2];
          if (this.verifyEvent(event) && matchFilters(so.filters, event)) {
            so.onevent(event);
          }
          return;
        }
        case "COUNT": {
          const id = data[1];
          const payload = data[2];
          const cr = this.openCountRequests.get(id);
          if (cr) {
            cr.resolve(payload.count);
            this.openCountRequests.delete(id);
          }
          return;
        }
        case "EOSE": {
          const so = this.openSubs.get(data[1]);
          if (!so)
            return;
          so.receivedEose();
          return;
        }
        case "OK": {
          const id = data[1];
          const ok = data[2];
          const reason = data[3];
          const ep = this.openEventPublishes.get(id);
          if (ok)
            ep.resolve(reason);
          else
            ep.reject(new Error(reason));
          this.openEventPublishes.delete(id);
          return;
        }
        case "CLOSED": {
          const id = data[1];
          const so = this.openSubs.get(id);
          if (!so)
            return;
          so.closed = true;
          so.close(data[2]);
          return;
        }
        case "NOTICE":
          this.onnotice(data[1]);
          return;
        case "AUTH": {
          this.challenge = data[1];
          (_c = this._onauth) == null ? void 0 : _c.call(this, data[1]);
          return;
        }
      }
    } catch (err) {
      return;
    }
  }
  async send(message) {
    if (!this.connectionPromise)
      throw new Error("sending on closed connection");
    this.connectionPromise.then(() => {
      var _a;
      (_a = this.ws) == null ? void 0 : _a.send(message);
    });
  }
  async auth(signAuthEvent) {
    if (!this.challenge)
      throw new Error("can't perform auth, no challenge was received");
    const evt = await signAuthEvent(makeAuthEvent(this.url, this.challenge));
    const ret = new Promise((resolve2, reject) => {
      this.openEventPublishes.set(evt.id, { resolve: resolve2, reject });
    });
    this.send('["AUTH",' + JSON.stringify(evt) + "]");
    return ret;
  }
  async publish(event) {
    const ret = new Promise((resolve2, reject) => {
      this.openEventPublishes.set(event.id, { resolve: resolve2, reject });
    });
    this.send('["EVENT",' + JSON.stringify(event) + "]");
    return ret;
  }
  async count(filters, params) {
    this.serial++;
    const id = (params == null ? void 0 : params.id) || "count:" + this.serial;
    const ret = new Promise((resolve2, reject) => {
      this.openCountRequests.set(id, { resolve: resolve2, reject });
    });
    this.send('["COUNT","' + id + '",' + JSON.stringify(filters).substring(1));
    return ret;
  }
  subscribe(filters, params) {
    const subscription = this.prepareSubscription(filters, params);
    subscription.fire();
    return subscription;
  }
  prepareSubscription(filters, params) {
    this.serial++;
    const id = params.id || "sub:" + this.serial;
    const subscription = new Subscription(this, id, filters, params);
    this.openSubs.set(id, subscription);
    return subscription;
  }
  close() {
    var _a;
    this.closeAllSubscriptions("relay connection closed by us");
    this._connected = false;
    (_a = this.ws) == null ? void 0 : _a.close();
  }
  _onmessage(ev) {
    this.incomingMessageQueue.enqueue(ev.data);
    if (!this.queueRunning) {
      this.runQueue();
    }
  }
};
var Subscription = class {
  constructor(relay, id, filters, params) {
    __publicField(this, "relay");
    __publicField(this, "id");
    __publicField(this, "closed", false);
    __publicField(this, "eosed", false);
    __publicField(this, "filters");
    __publicField(this, "alreadyHaveEvent");
    __publicField(this, "receivedEvent");
    __publicField(this, "onevent");
    __publicField(this, "oneose");
    __publicField(this, "onclose");
    __publicField(this, "eoseTimeout");
    __publicField(this, "eoseTimeoutHandle");
    this.relay = relay;
    this.filters = filters;
    this.id = id;
    this.alreadyHaveEvent = params.alreadyHaveEvent;
    this.receivedEvent = params.receivedEvent;
    this.eoseTimeout = params.eoseTimeout || relay.baseEoseTimeout;
    this.oneose = params.oneose;
    this.onclose = params.onclose;
    this.onevent = params.onevent || ((event) => {
      console.warn(
        `onevent() callback not defined for subscription '${this.id}' in relay ${this.relay.url}. event received:`,
        event
      );
    });
  }
  fire() {
    this.relay.send('["REQ","' + this.id + '",' + JSON.stringify(this.filters).substring(1));
    this.eoseTimeoutHandle = setTimeout(this.receivedEose.bind(this), this.eoseTimeout);
  }
  receivedEose() {
    var _a;
    if (this.eosed)
      return;
    clearTimeout(this.eoseTimeoutHandle);
    this.eosed = true;
    (_a = this.oneose) == null ? void 0 : _a.call(this);
  }
  close(reason = "closed by caller") {
    var _a;
    if (!this.closed && this.relay.connected) {
      this.relay.send('["CLOSE",' + JSON.stringify(this.id) + "]");
      this.closed = true;
    }
    this.relay.openSubs.delete(this.id);
    (_a = this.onclose) == null ? void 0 : _a.call(this, reason);
  }
};
var Relay = class extends AbstractRelay {
  constructor(url) {
    super(url, { verifyEvent });
  }
  static async connect(url) {
    const relay = new Relay(url);
    await relay.connect();
    return relay;
  }
};
var AbstractSimplePool = class {
  constructor(opts) {
    __publicField(this, "relays", /* @__PURE__ */ new Map());
    __publicField(this, "seenOn", /* @__PURE__ */ new Map());
    __publicField(this, "trackRelays", false);
    __publicField(this, "verifyEvent");
    __publicField(this, "trustedRelayURLs", /* @__PURE__ */ new Set());
    this.verifyEvent = opts.verifyEvent;
  }
  async ensureRelay(url, params) {
    url = normalizeURL$2(url);
    let relay = this.relays.get(url);
    if (!relay) {
      relay = new AbstractRelay(url, {
        verifyEvent: this.trustedRelayURLs.has(url) ? alwaysTrue : this.verifyEvent
      });
      if (params == null ? void 0 : params.connectionTimeout)
        relay.connectionTimeout = params.connectionTimeout;
      this.relays.set(url, relay);
    }
    await relay.connect();
    return relay;
  }
  close(relays) {
    relays.map(normalizeURL$2).forEach((url) => {
      var _a;
      (_a = this.relays.get(url)) == null ? void 0 : _a.close();
    });
  }
  subscribeMany(relays, filters, params) {
    return this.subscribeManyMap(Object.fromEntries(relays.map((url) => [url, filters])), params);
  }
  subscribeManyMap(requests, params) {
    if (this.trackRelays) {
      params.receivedEvent = (relay, id) => {
        let set2 = this.seenOn.get(id);
        if (!set2) {
          set2 = /* @__PURE__ */ new Set();
          this.seenOn.set(id, set2);
        }
        set2.add(relay);
      };
    }
    const _knownIds = /* @__PURE__ */ new Set();
    const subs = [];
    const relaysLength = Object.keys(requests).length;
    const eosesReceived = [];
    let handleEose = (i2) => {
      var _a;
      eosesReceived[i2] = true;
      if (eosesReceived.filter((a) => a).length === relaysLength) {
        (_a = params.oneose) == null ? void 0 : _a.call(params);
        handleEose = () => {
        };
      }
    };
    const closesReceived = [];
    let handleClose = (i2, reason) => {
      var _a;
      handleEose(i2);
      closesReceived[i2] = reason;
      if (closesReceived.filter((a) => a).length === relaysLength) {
        (_a = params.onclose) == null ? void 0 : _a.call(params, closesReceived);
        handleClose = () => {
        };
      }
    };
    const localAlreadyHaveEventHandler = (id) => {
      var _a;
      if ((_a = params.alreadyHaveEvent) == null ? void 0 : _a.call(params, id)) {
        return true;
      }
      const have = _knownIds.has(id);
      _knownIds.add(id);
      return have;
    };
    const allOpened = Promise.all(
      Object.entries(requests).map(async (req, i2, arr) => {
        if (arr.indexOf(req) !== i2) {
          handleClose(i2, "duplicate url");
          return;
        }
        let [url, filters] = req;
        url = normalizeURL$2(url);
        let relay;
        try {
          relay = await this.ensureRelay(url, {
            connectionTimeout: params.maxWait ? Math.max(params.maxWait * 0.8, params.maxWait - 1e3) : void 0
          });
        } catch (err) {
          handleClose(i2, (err == null ? void 0 : err.message) || String(err));
          return;
        }
        let subscription = relay.subscribe(filters, {
          ...params,
          oneose: () => handleEose(i2),
          onclose: (reason) => handleClose(i2, reason),
          alreadyHaveEvent: localAlreadyHaveEventHandler,
          eoseTimeout: params.maxWait
        });
        subs.push(subscription);
      })
    );
    return {
      async close() {
        await allOpened;
        subs.forEach((sub) => {
          sub.close();
        });
      }
    };
  }
  subscribeManyEose(relays, filters, params) {
    const subcloser = this.subscribeMany(relays, filters, {
      ...params,
      oneose() {
        subcloser.close();
      }
    });
    return subcloser;
  }
  async querySync(relays, filter, params) {
    return new Promise(async (resolve2) => {
      const events = [];
      this.subscribeManyEose(relays, [filter], {
        ...params,
        onevent(event) {
          events.push(event);
        },
        onclose(_) {
          resolve2(events);
        }
      });
    });
  }
  async get(relays, filter, params) {
    filter.limit = 1;
    const events = await this.querySync(relays, filter, params);
    events.sort((a, b) => b.created_at - a.created_at);
    return events[0] || null;
  }
  publish(relays, event) {
    return relays.map(normalizeURL$2).map(async (url, i2, arr) => {
      if (arr.indexOf(url) !== i2) {
        return Promise.reject("duplicate url");
      }
      let r = await this.ensureRelay(url);
      return r.publish(event);
    });
  }
};
var SimplePool = class extends AbstractSimplePool {
  constructor() {
    super({ verifyEvent });
  }
};
var nip19_exports = {};
__export(nip19_exports, {
  BECH32_REGEX: () => BECH32_REGEX,
  Bech32MaxSize: () => Bech32MaxSize,
  decode: () => decode,
  encodeBytes: () => encodeBytes,
  naddrEncode: () => naddrEncode,
  neventEncode: () => neventEncode,
  noteEncode: () => noteEncode,
  nprofileEncode: () => nprofileEncode,
  npubEncode: () => npubEncode,
  nrelayEncode: () => nrelayEncode,
  nsecEncode: () => nsecEncode
});
var Bech32MaxSize = 5e3;
var BECH32_REGEX = /[\x21-\x7E]{1,83}1[023456789acdefghjklmnpqrstuvwxyz]{6,}/;
function integerToUint8Array(number2) {
  const uint8Array = new Uint8Array(4);
  uint8Array[0] = number2 >> 24 & 255;
  uint8Array[1] = number2 >> 16 & 255;
  uint8Array[2] = number2 >> 8 & 255;
  uint8Array[3] = number2 & 255;
  return uint8Array;
}
function decode(nip19) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  let { prefix, words } = bech32.decode(nip19, Bech32MaxSize);
  let data = new Uint8Array(bech32.fromWords(words));
  switch (prefix) {
    case "nprofile": {
      let tlv = parseTLV(data);
      if (!((_a = tlv[0]) == null ? void 0 : _a[0]))
        throw new Error("missing TLV 0 for nprofile");
      if (tlv[0][0].length !== 32)
        throw new Error("TLV 0 should be 32 bytes");
      return {
        type: "nprofile",
        data: {
          pubkey: bytesToHex$1(tlv[0][0]),
          relays: tlv[1] ? tlv[1].map((d) => utf8Decoder.decode(d)) : []
        }
      };
    }
    case "nevent": {
      let tlv = parseTLV(data);
      if (!((_b = tlv[0]) == null ? void 0 : _b[0]))
        throw new Error("missing TLV 0 for nevent");
      if (tlv[0][0].length !== 32)
        throw new Error("TLV 0 should be 32 bytes");
      if (tlv[2] && tlv[2][0].length !== 32)
        throw new Error("TLV 2 should be 32 bytes");
      if (tlv[3] && tlv[3][0].length !== 4)
        throw new Error("TLV 3 should be 4 bytes");
      return {
        type: "nevent",
        data: {
          id: bytesToHex$1(tlv[0][0]),
          relays: tlv[1] ? tlv[1].map((d) => utf8Decoder.decode(d)) : [],
          author: ((_c = tlv[2]) == null ? void 0 : _c[0]) ? bytesToHex$1(tlv[2][0]) : void 0,
          kind: ((_d = tlv[3]) == null ? void 0 : _d[0]) ? parseInt(bytesToHex$1(tlv[3][0]), 16) : void 0
        }
      };
    }
    case "naddr": {
      let tlv = parseTLV(data);
      if (!((_e = tlv[0]) == null ? void 0 : _e[0]))
        throw new Error("missing TLV 0 for naddr");
      if (!((_f = tlv[2]) == null ? void 0 : _f[0]))
        throw new Error("missing TLV 2 for naddr");
      if (tlv[2][0].length !== 32)
        throw new Error("TLV 2 should be 32 bytes");
      if (!((_g = tlv[3]) == null ? void 0 : _g[0]))
        throw new Error("missing TLV 3 for naddr");
      if (tlv[3][0].length !== 4)
        throw new Error("TLV 3 should be 4 bytes");
      return {
        type: "naddr",
        data: {
          identifier: utf8Decoder.decode(tlv[0][0]),
          pubkey: bytesToHex$1(tlv[2][0]),
          kind: parseInt(bytesToHex$1(tlv[3][0]), 16),
          relays: tlv[1] ? tlv[1].map((d) => utf8Decoder.decode(d)) : []
        }
      };
    }
    case "nrelay": {
      let tlv = parseTLV(data);
      if (!((_h = tlv[0]) == null ? void 0 : _h[0]))
        throw new Error("missing TLV 0 for nrelay");
      return {
        type: "nrelay",
        data: utf8Decoder.decode(tlv[0][0])
      };
    }
    case "nsec":
      return { type: prefix, data };
    case "npub":
    case "note":
      return { type: prefix, data: bytesToHex$1(data) };
    default:
      throw new Error(`unknown prefix ${prefix}`);
  }
}
function parseTLV(data) {
  let result = {};
  let rest = data;
  while (rest.length > 0) {
    let t = rest[0];
    let l = rest[1];
    let v = rest.slice(2, 2 + l);
    rest = rest.slice(2 + l);
    if (v.length < l)
      throw new Error(`not enough data to read on TLV ${t}`);
    result[t] = result[t] || [];
    result[t].push(v);
  }
  return result;
}
function nsecEncode(key) {
  return encodeBytes("nsec", key);
}
function npubEncode(hex2) {
  return encodeBytes("npub", hexToBytes$1(hex2));
}
function noteEncode(hex2) {
  return encodeBytes("note", hexToBytes$1(hex2));
}
function encodeBech32(prefix, data) {
  let words = bech32.toWords(data);
  return bech32.encode(prefix, words, Bech32MaxSize);
}
function encodeBytes(prefix, bytes2) {
  return encodeBech32(prefix, bytes2);
}
function nprofileEncode(profile) {
  let data = encodeTLV({
    0: [hexToBytes$1(profile.pubkey)],
    1: (profile.relays || []).map((url) => utf8Encoder.encode(url))
  });
  return encodeBech32("nprofile", data);
}
function neventEncode(event) {
  let kindArray;
  if (event.kind !== void 0) {
    kindArray = integerToUint8Array(event.kind);
  }
  let data = encodeTLV({
    0: [hexToBytes$1(event.id)],
    1: (event.relays || []).map((url) => utf8Encoder.encode(url)),
    2: event.author ? [hexToBytes$1(event.author)] : [],
    3: kindArray ? [new Uint8Array(kindArray)] : []
  });
  return encodeBech32("nevent", data);
}
function naddrEncode(addr) {
  let kind = new ArrayBuffer(4);
  new DataView(kind).setUint32(0, addr.kind, false);
  let data = encodeTLV({
    0: [utf8Encoder.encode(addr.identifier)],
    1: (addr.relays || []).map((url) => utf8Encoder.encode(url)),
    2: [hexToBytes$1(addr.pubkey)],
    3: [new Uint8Array(kind)]
  });
  return encodeBech32("naddr", data);
}
function nrelayEncode(url) {
  let data = encodeTLV({
    0: [utf8Encoder.encode(url)]
  });
  return encodeBech32("nrelay", data);
}
function encodeTLV(tlv) {
  let entries = [];
  Object.entries(tlv).reverse().forEach(([t, vs]) => {
    vs.forEach((v) => {
      let entry = new Uint8Array(v.length + 2);
      entry.set([parseInt(t)], 0);
      entry.set([v.length], 1);
      entry.set(v, 2);
      entries.push(entry);
    });
  });
  return concatBytes(...entries);
}
var mentionRegex = /\bnostr:((note|npub|naddr|nevent|nprofile)1\w+)\b|#\[(\d+)\]/g;
function parseReferences(evt) {
  let references = [];
  for (let ref2 of evt.content.matchAll(mentionRegex)) {
    if (ref2[2]) {
      try {
        let { type, data } = decode(ref2[1]);
        switch (type) {
          case "npub": {
            references.push({
              text: ref2[0],
              profile: { pubkey: data, relays: [] }
            });
            break;
          }
          case "nprofile": {
            references.push({
              text: ref2[0],
              profile: data
            });
            break;
          }
          case "note": {
            references.push({
              text: ref2[0],
              event: { id: data, relays: [] }
            });
            break;
          }
          case "nevent": {
            references.push({
              text: ref2[0],
              event: data
            });
            break;
          }
          case "naddr": {
            references.push({
              text: ref2[0],
              address: data
            });
            break;
          }
        }
      } catch (err) {
      }
    } else if (ref2[3]) {
      let idx = parseInt(ref2[3], 10);
      let tag = evt.tags[idx];
      if (!tag)
        continue;
      switch (tag[0]) {
        case "p": {
          references.push({
            text: ref2[0],
            profile: { pubkey: tag[1], relays: tag[2] ? [tag[2]] : [] }
          });
          break;
        }
        case "e": {
          references.push({
            text: ref2[0],
            event: { id: tag[1], relays: tag[2] ? [tag[2]] : [] }
          });
          break;
        }
        case "a": {
          try {
            let [kind, pubkey, identifier] = tag[1].split(":");
            references.push({
              text: ref2[0],
              address: {
                identifier,
                pubkey,
                kind: parseInt(kind, 10),
                relays: tag[2] ? [tag[2]] : []
              }
            });
          } catch (err) {
          }
          break;
        }
      }
    }
  }
  return references;
}
var nip04_exports = {};
__export(nip04_exports, {
  decrypt: () => decrypt,
  encrypt: () => encrypt
});
async function encrypt(secretKey, pubkey, text) {
  const privkey = secretKey instanceof Uint8Array ? bytesToHex$1(secretKey) : secretKey;
  const key = secp256k1.getSharedSecret(privkey, "02" + pubkey);
  const normalizedKey = getNormalizedX(key);
  let iv = Uint8Array.from(randomBytes(16));
  let plaintext = utf8Encoder.encode(text);
  let ciphertext = cbc(normalizedKey, iv).encrypt(plaintext);
  let ctb64 = base64.encode(new Uint8Array(ciphertext));
  let ivb64 = base64.encode(new Uint8Array(iv.buffer));
  return `${ctb64}?iv=${ivb64}`;
}
async function decrypt(secretKey, pubkey, data) {
  const privkey = secretKey instanceof Uint8Array ? bytesToHex$1(secretKey) : secretKey;
  let [ctb64, ivb64] = data.split("?iv=");
  let key = secp256k1.getSharedSecret(privkey, "02" + pubkey);
  let normalizedKey = getNormalizedX(key);
  let iv = base64.decode(ivb64);
  let ciphertext = base64.decode(ctb64);
  let plaintext = cbc(normalizedKey, iv).decrypt(ciphertext);
  return utf8Decoder.decode(plaintext);
}
function getNormalizedX(key) {
  return key.slice(1, 33);
}
var nip05_exports = {};
__export(nip05_exports, {
  NIP05_REGEX: () => NIP05_REGEX,
  isValid: () => isValid,
  queryProfile: () => queryProfile,
  searchDomain: () => searchDomain,
  useFetchImplementation: () => useFetchImplementation
});
var NIP05_REGEX = /^(?:([\w.+-]+)@)?([\w_-]+(\.[\w_-]+)+)$/;
var _fetch;
try {
  _fetch = fetch;
} catch {
}
function useFetchImplementation(fetchImplementation) {
  _fetch = fetchImplementation;
}
async function searchDomain(domain, query = "") {
  try {
    const url = `https://${domain}/.well-known/nostr.json?name=${query}`;
    const res = await _fetch(url, { redirect: "error" });
    const json = await res.json();
    return json.names;
  } catch (_) {
    return {};
  }
}
async function queryProfile(fullname) {
  var _a;
  const match = fullname.match(NIP05_REGEX);
  if (!match)
    return null;
  const [_, name = "_", domain] = match;
  try {
    const url = `https://${domain}/.well-known/nostr.json?name=${name}`;
    const res = await (await _fetch(url, { redirect: "error" })).json();
    let pubkey = res.names[name];
    return pubkey ? { pubkey, relays: (_a = res.relays) == null ? void 0 : _a[pubkey] } : null;
  } catch (_e) {
    return null;
  }
}
async function isValid(pubkey, nip05) {
  let res = await queryProfile(nip05);
  return res ? res.pubkey === pubkey : false;
}
var nip10_exports = {};
__export(nip10_exports, {
  parse: () => parse
});
function parse(event) {
  const result = {
    reply: void 0,
    root: void 0,
    mentions: [],
    profiles: []
  };
  const eTags = [];
  for (const tag of event.tags) {
    if (tag[0] === "e" && tag[1]) {
      eTags.push(tag);
    }
    if (tag[0] === "p" && tag[1]) {
      result.profiles.push({
        pubkey: tag[1],
        relays: tag[2] ? [tag[2]] : []
      });
    }
  }
  for (let eTagIndex = 0; eTagIndex < eTags.length; eTagIndex++) {
    const eTag = eTags[eTagIndex];
    const [_, eTagEventId, eTagRelayUrl, eTagMarker] = eTag;
    const eventPointer = {
      id: eTagEventId,
      relays: eTagRelayUrl ? [eTagRelayUrl] : []
    };
    const isFirstETag = eTagIndex === 0;
    const isLastETag = eTagIndex === eTags.length - 1;
    if (eTagMarker === "root") {
      result.root = eventPointer;
      continue;
    }
    if (eTagMarker === "reply") {
      result.reply = eventPointer;
      continue;
    }
    if (eTagMarker === "mention") {
      result.mentions.push(eventPointer);
      continue;
    }
    if (isFirstETag) {
      result.root = eventPointer;
      continue;
    }
    if (isLastETag) {
      result.reply = eventPointer;
      continue;
    }
    result.mentions.push(eventPointer);
  }
  return result;
}
var nip11_exports = {};
__export(nip11_exports, {
  fetchRelayInformation: () => fetchRelayInformation,
  useFetchImplementation: () => useFetchImplementation2
});
var _fetch2;
try {
  _fetch2 = fetch;
} catch {
}
function useFetchImplementation2(fetchImplementation) {
  _fetch2 = fetchImplementation;
}
async function fetchRelayInformation(url) {
  return await (await fetch(url.replace("ws://", "http://").replace("wss://", "https://"), {
    headers: { Accept: "application/nostr+json" }
  })).json();
}
var nip13_exports = {};
__export(nip13_exports, {
  getPow: () => getPow,
  minePow: () => minePow
});
function getPow(hex2) {
  let count = 0;
  for (let i2 = 0; i2 < hex2.length; i2++) {
    const nibble = parseInt(hex2[i2], 16);
    if (nibble === 0) {
      count += 4;
    } else {
      count += Math.clz32(nibble) - 28;
      break;
    }
  }
  return count;
}
function minePow(unsigned, difficulty) {
  let count = 0;
  const event = unsigned;
  const tag = ["nonce", count.toString(), difficulty.toString()];
  event.tags.push(tag);
  while (true) {
    const now2 = Math.floor((/* @__PURE__ */ new Date()).getTime() / 1e3);
    if (now2 !== event.created_at) {
      count = 0;
      event.created_at = now2;
    }
    tag[1] = (++count).toString();
    event.id = getEventHash(event);
    if (getPow(event.id) >= difficulty) {
      break;
    }
  }
  return event;
}
var nip18_exports = {};
__export(nip18_exports, {
  finishRepostEvent: () => finishRepostEvent,
  getRepostedEvent: () => getRepostedEvent,
  getRepostedEventPointer: () => getRepostedEventPointer
});
function finishRepostEvent(t, reposted, relayUrl, privateKey) {
  return finalizeEvent(
    {
      kind: Repost,
      tags: [...t.tags ?? [], ["e", reposted.id, relayUrl], ["p", reposted.pubkey]],
      content: t.content === "" ? "" : JSON.stringify(reposted),
      created_at: t.created_at
    },
    privateKey
  );
}
function getRepostedEventPointer(event) {
  if (event.kind !== Repost) {
    return void 0;
  }
  let lastETag;
  let lastPTag;
  for (let i2 = event.tags.length - 1; i2 >= 0 && (lastETag === void 0 || lastPTag === void 0); i2--) {
    const tag = event.tags[i2];
    if (tag.length >= 2) {
      if (tag[0] === "e" && lastETag === void 0) {
        lastETag = tag;
      } else if (tag[0] === "p" && lastPTag === void 0) {
        lastPTag = tag;
      }
    }
  }
  if (lastETag === void 0) {
    return void 0;
  }
  return {
    id: lastETag[1],
    relays: [lastETag[2], lastPTag == null ? void 0 : lastPTag[2]].filter((x) => typeof x === "string"),
    author: lastPTag == null ? void 0 : lastPTag[1]
  };
}
function getRepostedEvent(event, { skipVerification } = {}) {
  const pointer = getRepostedEventPointer(event);
  if (pointer === void 0 || event.content === "") {
    return void 0;
  }
  let repostedEvent;
  try {
    repostedEvent = JSON.parse(event.content);
  } catch (error) {
    return void 0;
  }
  if (repostedEvent.id !== pointer.id) {
    return void 0;
  }
  if (!skipVerification && !verifyEvent(repostedEvent)) {
    return void 0;
  }
  return repostedEvent;
}
var nip21_exports = {};
__export(nip21_exports, {
  NOSTR_URI_REGEX: () => NOSTR_URI_REGEX,
  parse: () => parse2,
  test: () => test
});
var NOSTR_URI_REGEX = new RegExp(`nostr:(${BECH32_REGEX.source})`);
function test(value) {
  return typeof value === "string" && new RegExp(`^${NOSTR_URI_REGEX.source}$`).test(value);
}
function parse2(uri) {
  const match = uri.match(new RegExp(`^${NOSTR_URI_REGEX.source}$`));
  if (!match)
    throw new Error(`Invalid Nostr URI: ${uri}`);
  return {
    uri: match[0],
    value: match[1],
    decoded: decode(match[1])
  };
}
var nip25_exports = {};
__export(nip25_exports, {
  finishReactionEvent: () => finishReactionEvent,
  getReactedEventPointer: () => getReactedEventPointer
});
function finishReactionEvent(t, reacted, privateKey) {
  const inheritedTags = reacted.tags.filter((tag) => tag.length >= 2 && (tag[0] === "e" || tag[0] === "p"));
  return finalizeEvent(
    {
      ...t,
      kind: Reaction,
      tags: [...t.tags ?? [], ...inheritedTags, ["e", reacted.id], ["p", reacted.pubkey]],
      content: t.content ?? "+"
    },
    privateKey
  );
}
function getReactedEventPointer(event) {
  if (event.kind !== Reaction) {
    return void 0;
  }
  let lastETag;
  let lastPTag;
  for (let i2 = event.tags.length - 1; i2 >= 0 && (lastETag === void 0 || lastPTag === void 0); i2--) {
    const tag = event.tags[i2];
    if (tag.length >= 2) {
      if (tag[0] === "e" && lastETag === void 0) {
        lastETag = tag;
      } else if (tag[0] === "p" && lastPTag === void 0) {
        lastPTag = tag;
      }
    }
  }
  if (lastETag === void 0 || lastPTag === void 0) {
    return void 0;
  }
  return {
    id: lastETag[1],
    relays: [lastETag[2], lastPTag[2]].filter((x) => x !== void 0),
    author: lastPTag[1]
  };
}
var nip27_exports = {};
__export(nip27_exports, {
  matchAll: () => matchAll,
  regex: () => regex,
  replaceAll: () => replaceAll
});
var regex = () => new RegExp(`\\b${NOSTR_URI_REGEX.source}\\b`, "g");
function* matchAll(content) {
  const matches = content.matchAll(regex());
  for (const match of matches) {
    try {
      const [uri, value] = match;
      yield {
        uri,
        value,
        decoded: decode(value),
        start: match.index,
        end: match.index + uri.length
      };
    } catch (_e) {
    }
  }
}
function replaceAll(content, replacer2) {
  return content.replaceAll(regex(), (uri, value) => {
    return replacer2({
      uri,
      value,
      decoded: decode(value)
    });
  });
}
var nip28_exports = {};
__export(nip28_exports, {
  channelCreateEvent: () => channelCreateEvent,
  channelHideMessageEvent: () => channelHideMessageEvent,
  channelMessageEvent: () => channelMessageEvent,
  channelMetadataEvent: () => channelMetadataEvent,
  channelMuteUserEvent: () => channelMuteUserEvent
});
var channelCreateEvent = (t, privateKey) => {
  let content;
  if (typeof t.content === "object") {
    content = JSON.stringify(t.content);
  } else if (typeof t.content === "string") {
    content = t.content;
  } else {
    return void 0;
  }
  return finalizeEvent(
    {
      kind: ChannelCreation,
      tags: [...t.tags ?? []],
      content,
      created_at: t.created_at
    },
    privateKey
  );
};
var channelMetadataEvent = (t, privateKey) => {
  let content;
  if (typeof t.content === "object") {
    content = JSON.stringify(t.content);
  } else if (typeof t.content === "string") {
    content = t.content;
  } else {
    return void 0;
  }
  return finalizeEvent(
    {
      kind: ChannelMetadata,
      tags: [["e", t.channel_create_event_id], ...t.tags ?? []],
      content,
      created_at: t.created_at
    },
    privateKey
  );
};
var channelMessageEvent = (t, privateKey) => {
  const tags = [["e", t.channel_create_event_id, t.relay_url, "root"]];
  if (t.reply_to_channel_message_event_id) {
    tags.push(["e", t.reply_to_channel_message_event_id, t.relay_url, "reply"]);
  }
  return finalizeEvent(
    {
      kind: ChannelMessage,
      tags: [...tags, ...t.tags ?? []],
      content: t.content,
      created_at: t.created_at
    },
    privateKey
  );
};
var channelHideMessageEvent = (t, privateKey) => {
  let content;
  if (typeof t.content === "object") {
    content = JSON.stringify(t.content);
  } else if (typeof t.content === "string") {
    content = t.content;
  } else {
    return void 0;
  }
  return finalizeEvent(
    {
      kind: ChannelHideMessage,
      tags: [["e", t.channel_message_event_id], ...t.tags ?? []],
      content,
      created_at: t.created_at
    },
    privateKey
  );
};
var channelMuteUserEvent = (t, privateKey) => {
  let content;
  if (typeof t.content === "object") {
    content = JSON.stringify(t.content);
  } else if (typeof t.content === "string") {
    content = t.content;
  } else {
    return void 0;
  }
  return finalizeEvent(
    {
      kind: ChannelMuteUser,
      tags: [["p", t.pubkey_to_mute], ...t.tags ?? []],
      content,
      created_at: t.created_at
    },
    privateKey
  );
};
var nip30_exports = {};
__export(nip30_exports, {
  EMOJI_SHORTCODE_REGEX: () => EMOJI_SHORTCODE_REGEX,
  matchAll: () => matchAll2,
  regex: () => regex2,
  replaceAll: () => replaceAll2
});
var EMOJI_SHORTCODE_REGEX = /:(\w+):/;
var regex2 = () => new RegExp(`\\B${EMOJI_SHORTCODE_REGEX.source}\\B`, "g");
function* matchAll2(content) {
  const matches = content.matchAll(regex2());
  for (const match of matches) {
    try {
      const [shortcode, name] = match;
      yield {
        shortcode,
        name,
        start: match.index,
        end: match.index + shortcode.length
      };
    } catch (_e) {
    }
  }
}
function replaceAll2(content, replacer2) {
  return content.replaceAll(regex2(), (shortcode, name) => {
    return replacer2({
      shortcode,
      name
    });
  });
}
var nip39_exports = {};
__export(nip39_exports, {
  useFetchImplementation: () => useFetchImplementation3,
  validateGithub: () => validateGithub
});
var _fetch3;
try {
  _fetch3 = fetch;
} catch {
}
function useFetchImplementation3(fetchImplementation) {
  _fetch3 = fetchImplementation;
}
async function validateGithub(pubkey, username, proof) {
  try {
    let res = await (await _fetch3(`https://gist.github.com/${username}/${proof}/raw`)).text();
    return res === `Verifying that I control the following Nostr public key: ${pubkey}`;
  } catch (_) {
    return false;
  }
}
var nip44_exports = {};
__export(nip44_exports, {
  default: () => nip44_default,
  v2: () => v2
});
var decoder = new TextDecoder();
var _u = class {
  static utf8Decode(bytes2) {
    return decoder.decode(bytes2);
  }
  static getConversationKey(privkeyA, pubkeyB) {
    const sharedX = secp256k1.getSharedSecret(privkeyA, "02" + pubkeyB).subarray(1, 33);
    return extract(sha256$1, sharedX, "nip44-v2");
  }
  static getMessageKeys(conversationKey, nonce) {
    const keys = expand(sha256$1, conversationKey, nonce, 76);
    return {
      chacha_key: keys.subarray(0, 32),
      chacha_nonce: keys.subarray(32, 44),
      hmac_key: keys.subarray(44, 76)
    };
  }
  static calcPaddedLen(len) {
    if (!Number.isSafeInteger(len) || len < 1)
      throw new Error("expected positive integer");
    if (len <= 32)
      return 32;
    const nextPower = 1 << Math.floor(Math.log2(len - 1)) + 1;
    const chunk = nextPower <= 256 ? 32 : nextPower / 8;
    return chunk * (Math.floor((len - 1) / chunk) + 1);
  }
  static writeU16BE(num) {
    if (!Number.isSafeInteger(num) || num < _u.minPlaintextSize || num > _u.maxPlaintextSize)
      throw new Error("invalid plaintext size: must be between 1 and 65535 bytes");
    const arr = new Uint8Array(2);
    new DataView(arr.buffer).setUint16(0, num, false);
    return arr;
  }
  static pad(plaintext) {
    const unpadded = _u.utf8Encode(plaintext);
    const unpaddedLen = unpadded.length;
    const prefix = _u.writeU16BE(unpaddedLen);
    const suffix = new Uint8Array(_u.calcPaddedLen(unpaddedLen) - unpaddedLen);
    return concatBytes(prefix, unpadded, suffix);
  }
  static unpad(padded) {
    const unpaddedLen = new DataView(padded.buffer).getUint16(0);
    const unpadded = padded.subarray(2, 2 + unpaddedLen);
    if (unpaddedLen < _u.minPlaintextSize || unpaddedLen > _u.maxPlaintextSize || unpadded.length !== unpaddedLen || padded.length !== 2 + _u.calcPaddedLen(unpaddedLen))
      throw new Error("invalid padding");
    return _u.utf8Decode(unpadded);
  }
  static hmacAad(key, message, aad) {
    if (aad.length !== 32)
      throw new Error("AAD associated data must be 32 bytes");
    const combined = concatBytes(aad, message);
    return hmac(sha256$1, key, combined);
  }
  static decodePayload(payload) {
    if (typeof payload !== "string")
      throw new Error("payload must be a valid string");
    const plen = payload.length;
    if (plen < 132 || plen > 87472)
      throw new Error("invalid payload length: " + plen);
    if (payload[0] === "#")
      throw new Error("unknown encryption version");
    let data;
    try {
      data = base64.decode(payload);
    } catch (error) {
      throw new Error("invalid base64: " + error.message);
    }
    const dlen = data.length;
    if (dlen < 99 || dlen > 65603)
      throw new Error("invalid data length: " + dlen);
    const vers = data[0];
    if (vers !== 2)
      throw new Error("unknown encryption version " + vers);
    return {
      nonce: data.subarray(1, 33),
      ciphertext: data.subarray(33, -32),
      mac: data.subarray(-32)
    };
  }
};
var u = _u;
__publicField2(u, "minPlaintextSize", 1);
__publicField2(u, "maxPlaintextSize", 65535);
__publicField2(u, "utf8Encode", utf8ToBytes$1);
var v2 = class {
  static encrypt(plaintext, conversationKey, nonce = randomBytes(32)) {
    const { chacha_key, chacha_nonce, hmac_key } = u.getMessageKeys(conversationKey, nonce);
    const padded = u.pad(plaintext);
    const ciphertext = chacha20(chacha_key, chacha_nonce, padded);
    const mac = u.hmacAad(hmac_key, ciphertext, nonce);
    return base64.encode(concatBytes(new Uint8Array([2]), nonce, ciphertext, mac));
  }
  static decrypt(payload, conversationKey) {
    const { nonce, ciphertext, mac } = u.decodePayload(payload);
    const { chacha_key, chacha_nonce, hmac_key } = u.getMessageKeys(conversationKey, nonce);
    const calculatedMac = u.hmacAad(hmac_key, ciphertext, nonce);
    if (!equalBytes(calculatedMac, mac))
      throw new Error("invalid MAC");
    const padded = chacha20(chacha_key, chacha_nonce, ciphertext);
    return u.unpad(padded);
  }
};
__publicField2(v2, "utils", u);
var nip44_default = { v2 };
var nip47_exports = {};
__export(nip47_exports, {
  makeNwcRequestEvent: () => makeNwcRequestEvent,
  parseConnectionString: () => parseConnectionString
});
function parseConnectionString(connectionString) {
  const { pathname, searchParams } = new URL(connectionString);
  const pubkey = pathname;
  const relay = searchParams.get("relay");
  const secret = searchParams.get("secret");
  if (!pubkey || !relay || !secret) {
    throw new Error("invalid connection string");
  }
  return { pubkey, relay, secret };
}
async function makeNwcRequestEvent(pubkey, secretKey, invoice) {
  const content = {
    method: "pay_invoice",
    params: {
      invoice
    }
  };
  const encryptedContent = await encrypt(secretKey, pubkey, JSON.stringify(content));
  const eventTemplate = {
    kind: NWCWalletRequest,
    created_at: Math.round(Date.now() / 1e3),
    content: encryptedContent,
    tags: [["p", pubkey]]
  };
  return finalizeEvent(eventTemplate, secretKey);
}
var nip57_exports = {};
__export(nip57_exports, {
  getZapEndpoint: () => getZapEndpoint,
  makeZapReceipt: () => makeZapReceipt,
  makeZapRequest: () => makeZapRequest,
  useFetchImplementation: () => useFetchImplementation4,
  validateZapRequest: () => validateZapRequest
});
var _fetch4;
try {
  _fetch4 = fetch;
} catch {
}
function useFetchImplementation4(fetchImplementation) {
  _fetch4 = fetchImplementation;
}
async function getZapEndpoint(metadata) {
  try {
    let lnurl = "";
    let { lud06, lud16 } = JSON.parse(metadata.content);
    if (lud06) {
      let { words } = bech32.decode(lud06, 1e3);
      let data = bech32.fromWords(words);
      lnurl = utf8Decoder.decode(data);
    } else if (lud16) {
      let [name, domain] = lud16.split("@");
      lnurl = new URL(`/.well-known/lnurlp/${name}`, `https://${domain}`).toString();
    } else {
      return null;
    }
    let res = await _fetch4(lnurl);
    let body = await res.json();
    if (body.allowsNostr && body.nostrPubkey) {
      return body.callback;
    }
  } catch (err) {
  }
  return null;
}
function makeZapRequest({
  profile,
  event,
  amount,
  relays,
  comment = ""
}) {
  if (!amount)
    throw new Error("amount not given");
  if (!profile)
    throw new Error("profile not given");
  let zr = {
    kind: 9734,
    created_at: Math.round(Date.now() / 1e3),
    content: comment,
    tags: [
      ["p", profile],
      ["amount", amount.toString()],
      ["relays", ...relays]
    ]
  };
  if (event) {
    zr.tags.push(["e", event]);
  }
  return zr;
}
function validateZapRequest(zapRequestString) {
  let zapRequest;
  try {
    zapRequest = JSON.parse(zapRequestString);
  } catch (err) {
    return "Invalid zap request JSON.";
  }
  if (!validateEvent(zapRequest))
    return "Zap request is not a valid Nostr event.";
  if (!verifyEvent(zapRequest))
    return "Invalid signature on zap request.";
  let p2 = zapRequest.tags.find(([t, v]) => t === "p" && v);
  if (!p2)
    return "Zap request doesn't have a 'p' tag.";
  if (!p2[1].match(/^[a-f0-9]{64}$/))
    return "Zap request 'p' tag is not valid hex.";
  let e = zapRequest.tags.find(([t, v]) => t === "e" && v);
  if (e && !e[1].match(/^[a-f0-9]{64}$/))
    return "Zap request 'e' tag is not valid hex.";
  let relays = zapRequest.tags.find(([t, v]) => t === "relays" && v);
  if (!relays)
    return "Zap request doesn't have a 'relays' tag.";
  return null;
}
function makeZapReceipt({
  zapRequest,
  preimage,
  bolt11,
  paidAt
}) {
  let zr = JSON.parse(zapRequest);
  let tagsFromZapRequest = zr.tags.filter(([t]) => t === "e" || t === "p" || t === "a");
  let zap = {
    kind: 9735,
    created_at: Math.round(paidAt.getTime() / 1e3),
    content: "",
    tags: [...tagsFromZapRequest, ["P", zr.pubkey], ["bolt11", bolt11], ["description", zapRequest]]
  };
  if (preimage) {
    zap.tags.push(["preimage", preimage]);
  }
  return zap;
}
var nip98_exports = {};
__export(nip98_exports, {
  getToken: () => getToken,
  hashPayload: () => hashPayload,
  unpackEventFromToken: () => unpackEventFromToken,
  validateEvent: () => validateEvent2,
  validateEventKind: () => validateEventKind,
  validateEventMethodTag: () => validateEventMethodTag,
  validateEventPayloadTag: () => validateEventPayloadTag,
  validateEventTimestamp: () => validateEventTimestamp,
  validateEventUrlTag: () => validateEventUrlTag,
  validateToken: () => validateToken
});
var _authorizationScheme = "Nostr ";
async function getToken(loginUrl, httpMethod, sign, includeAuthorizationScheme = false, payload) {
  const event = {
    kind: HTTPAuth,
    tags: [
      ["u", loginUrl],
      ["method", httpMethod]
    ],
    created_at: Math.round((/* @__PURE__ */ new Date()).getTime() / 1e3),
    content: ""
  };
  if (payload) {
    event.tags.push(["payload", hashPayload(payload)]);
  }
  const signedEvent = await sign(event);
  const authorizationScheme = includeAuthorizationScheme ? _authorizationScheme : "";
  return authorizationScheme + base64.encode(utf8Encoder.encode(JSON.stringify(signedEvent)));
}
async function validateToken(token, url, method) {
  const event = await unpackEventFromToken(token).catch((error) => {
    throw error;
  });
  const valid = await validateEvent2(event, url, method).catch((error) => {
    throw error;
  });
  return valid;
}
async function unpackEventFromToken(token) {
  if (!token) {
    throw new Error("Missing token");
  }
  token = token.replace(_authorizationScheme, "");
  const eventB64 = utf8Decoder.decode(base64.decode(token));
  if (!eventB64 || eventB64.length === 0 || !eventB64.startsWith("{")) {
    throw new Error("Invalid token");
  }
  const event = JSON.parse(eventB64);
  return event;
}
function validateEventTimestamp(event) {
  if (!event.created_at) {
    return false;
  }
  return Math.round((/* @__PURE__ */ new Date()).getTime() / 1e3) - event.created_at < 60;
}
function validateEventKind(event) {
  return event.kind === HTTPAuth;
}
function validateEventUrlTag(event, url) {
  const urlTag = event.tags.find((t) => t[0] === "u");
  if (!urlTag) {
    return false;
  }
  return urlTag.length > 0 && urlTag[1] === url;
}
function validateEventMethodTag(event, method) {
  const methodTag = event.tags.find((t) => t[0] === "method");
  if (!methodTag) {
    return false;
  }
  return methodTag.length > 0 && methodTag[1].toLowerCase() === method.toLowerCase();
}
function hashPayload(payload) {
  const hash2 = sha256$1(utf8Encoder.encode(JSON.stringify(payload)));
  return bytesToHex$1(hash2);
}
function validateEventPayloadTag(event, payload) {
  const payloadTag = event.tags.find((t) => t[0] === "payload");
  if (!payloadTag) {
    return false;
  }
  const payloadHash = hashPayload(payload);
  return payloadTag.length > 0 && payloadTag[1] === payloadHash;
}
async function validateEvent2(event, url, method, body) {
  if (!verifyEvent(event)) {
    throw new Error("Invalid nostr event, signature invalid");
  }
  if (!validateEventKind(event)) {
    throw new Error("Invalid nostr event, kind invalid");
  }
  if (!validateEventTimestamp(event)) {
    throw new Error("Invalid nostr event, created_at timestamp invalid");
  }
  if (!validateEventUrlTag(event, url)) {
    throw new Error("Invalid nostr event, url tag invalid");
  }
  if (!validateEventMethodTag(event, method)) {
    throw new Error("Invalid nostr event, method tag invalid");
  }
  if (Boolean(body) && typeof body === "object" && Object.keys(body).length > 0) {
    if (!validateEventPayloadTag(event, body)) {
      throw new Error("Invalid nostr event, payload tag does not match request body hash");
    }
  }
  return true;
}
const _withScopeId$e = (n) => (pushScopeId("data-v-393546d0"), n = n(), popScopeId(), n);
const _hoisted_1$A = { class: "event-details" };
const _hoisted_2$x = { key: 0 };
const _hoisted_3$v = { class: "highlight" };
const _hoisted_4$n = { key: 1 };
const _hoisted_5$g = {
  key: 0,
  class: "highlight"
};
const _hoisted_6$e = {
  key: 1,
  class: "event-details__no-user"
};
const _hoisted_7$a = /* @__PURE__ */ _withScopeId$e(() => /* @__PURE__ */ createBaseVNode("div", null, "No info about author on this relay.", -1));
const _hoisted_8$9 = { class: "highlight" };
const _hoisted_9$9 = { key: 2 };
const _hoisted_10$9 = {
  key: 0,
  class: "highlight"
};
const _hoisted_11$7 = {
  key: 1,
  class: "event-details__no-user"
};
const _hoisted_12$7 = /* @__PURE__ */ _withScopeId$e(() => /* @__PURE__ */ createBaseVNode("div", null, "No info about author on this relay.", -1));
const _hoisted_13$6 = { class: "highlight" };
const _sfc_main$B = /* @__PURE__ */ defineComponent({
  __name: "RawData",
  props: {
    event: {},
    authorEvent: {},
    isUserEvent: {}
  },
  setup(__props) {
    const props = __props;
    const rawDataActiveTab = ref(1);
    const showAuthorTab = ref(true);
    const clearEvent = ref();
    const clearAuthorEvent = ref({});
    onMounted(() => {
      const { event, authorEvent } = props;
      clearEvent.value = sanitizeEvent(event);
      if (authorEvent) {
        clearAuthorEvent.value = sanitizeEvent(authorEvent);
      }
      if (!props.authorEvent)
        return;
      showAuthorTab.value = props.event.id !== props.authorEvent.id;
    });
    const sanitizeEvent = (event) => {
      const { id, pubkey, created_at, kind, tags, content, sig } = event;
      return { id, pubkey, created_at, kind, tags, content, sig };
    };
    const handleRawDataTabClick = (tab) => {
      rawDataActiveTab.value = tab;
    };
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$A, [
        createBaseVNode("div", {
          class: normalizeClass(["event-details__header", { "event-details__header_user": _ctx.isUserEvent }])
        }, [
          createBaseVNode("span", {
            onClick: _cache[0] || (_cache[0] = () => handleRawDataTabClick(1)),
            class: normalizeClass(["event-details__tab", { "event-details__tab_active": rawDataActiveTab.value === 1 }])
          }, "Note", 2),
          showAuthorTab.value ? (openBlock(), createElementBlock("span", {
            key: 0,
            onClick: _cache[1] || (_cache[1] = () => handleRawDataTabClick(2)),
            class: normalizeClass(["event-details__tab", { "event-details__tab_active": rawDataActiveTab.value === 2 }])
          }, "Author", 2)) : createCommentVNode("", true),
          createBaseVNode("span", {
            onClick: _cache[2] || (_cache[2] = () => handleRawDataTabClick(3)),
            class: normalizeClass(["event-details__tab", { "event-details__tab_active": rawDataActiveTab.value === 3 }])
          }, "Author content", 2)
        ], 2),
        rawDataActiveTab.value === 1 ? (openBlock(), createElementBlock("div", _hoisted_2$x, [
          createBaseVNode("pre", _hoisted_3$v, toDisplayString(JSON.stringify(clearEvent.value, null, 2)), 1)
        ])) : createCommentVNode("", true),
        showAuthorTab.value && rawDataActiveTab.value === 2 ? (openBlock(), createElementBlock("div", _hoisted_4$n, [
          _ctx.authorEvent ? (openBlock(), createElementBlock("pre", _hoisted_5$g, toDisplayString(JSON.stringify(clearAuthorEvent.value, null, 2)), 1)) : (openBlock(), createElementBlock("div", _hoisted_6$e, [
            _hoisted_7$a,
            createBaseVNode("pre", _hoisted_8$9, "pubkey: " + toDisplayString(_ctx.event.pubkey) + " \nnpub: " + toDisplayString(unref(nip19_exports).npubEncode(_ctx.event.pubkey)), 1)
          ]))
        ])) : createCommentVNode("", true),
        rawDataActiveTab.value === 3 ? (openBlock(), createElementBlock("div", _hoisted_9$9, [
          _ctx.event.author ? (openBlock(), createElementBlock("pre", _hoisted_10$9, toDisplayString(JSON.stringify(_ctx.event.author, null, 2)), 1)) : (openBlock(), createElementBlock("div", _hoisted_11$7, [
            _hoisted_12$7,
            createBaseVNode("pre", _hoisted_13$6, "pubkey: " + toDisplayString(_ctx.event.pubkey) + "\nnpub: " + toDisplayString(unref(nip19_exports).npubEncode(_ctx.event.pubkey)), 1)
          ]))
        ])) : createCommentVNode("", true)
      ]);
    };
  }
});
const RawData_vue_vue_type_style_index_0_scoped_393546d0_lang = "";
const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};
const RawData = /* @__PURE__ */ _export_sfc(_sfc_main$B, [["__scopeId", "data-v-393546d0"]]);
const _sfc_main$A = {};
const _hoisted_1$z = {
  xmlns: "http://www.w3.org/2000/svg",
  width: "16",
  height: "16",
  fill: "currentColor",
  class: "bi bi-heart",
  viewBox: "0 0 16 16"
};
const _hoisted_2$w = /* @__PURE__ */ createBaseVNode("path", { d: "m8 2.748-.717-.737C5.6.281 2.514.878 1.4 3.053c-.523 1.023-.641 2.5.314 4.385.92 1.815 2.834 3.989 6.286 6.357 3.452-2.368 5.365-4.542 6.286-6.357.955-1.886.838-3.362.314-4.385C13.486.878 10.4.28 8.717 2.01L8 2.748zM8 15C-7.333 4.868 3.279-3.04 7.824 1.143c.06.055.119.112.176.171a3.12 3.12 0 0 1 .176-.17C12.72-3.042 23.333 4.867 8 15z" }, null, -1);
const _hoisted_3$u = [
  _hoisted_2$w
];
function _sfc_render$c(_ctx, _cache) {
  return openBlock(), createElementBlock("svg", _hoisted_1$z, _hoisted_3$u);
}
const EmptyHeartIcon = /* @__PURE__ */ _export_sfc(_sfc_main$A, [["render", _sfc_render$c]]);
const _sfc_main$z = {};
const _hoisted_1$y = {
  xmlns: "http://www.w3.org/2000/svg",
  width: "16",
  height: "16",
  fill: "currentColor",
  class: "bi bi-repeat",
  viewBox: "0 0 16 16"
};
const _hoisted_2$v = /* @__PURE__ */ createBaseVNode("path", { d: "M11 5.466V4H5a4 4 0 0 0-3.584 5.777.5.5 0 1 1-.896.446A5 5 0 0 1 5 3h6V1.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384l-2.36 1.966a.25.25 0 0 1-.41-.192m3.81.086a.5.5 0 0 1 .67.225A5 5 0 0 1 11 13H5v1.466a.25.25 0 0 1-.41.192l-2.36-1.966a.25.25 0 0 1 0-.384l2.36-1.966a.25.25 0 0 1 .41.192V12h6a4 4 0 0 0 3.585-5.777.5.5 0 0 1 .225-.67Z" }, null, -1);
const _hoisted_3$t = [
  _hoisted_2$v
];
function _sfc_render$b(_ctx, _cache) {
  return openBlock(), createElementBlock("svg", _hoisted_1$y, _hoisted_3$t);
}
const ArrowRepeatIcon = /* @__PURE__ */ _export_sfc(_sfc_main$z, [["render", _sfc_render$b]]);
const _sfc_main$y = {};
const _hoisted_1$x = {
  xmlns: "http://www.w3.org/2000/svg",
  width: "22",
  height: "22",
  fill: "currentColor",
  class: "bi bi-reply",
  viewBox: "0 0 16 16"
};
const _hoisted_2$u = /* @__PURE__ */ createBaseVNode("path", { d: "M6.598 5.013a.144.144 0 0 1 .202.134V6.3a.5.5 0 0 0 .5.5c.667 0 2.013.005 3.3.822.984.624 1.99 1.76 2.595 3.876-1.02-.983-2.185-1.516-3.205-1.799a8.74 8.74 0 0 0-1.921-.306 7.404 7.404 0 0 0-.798.008h-.013l-.005.001h-.001L7.3 9.9l-.05-.498a.5.5 0 0 0-.45.498v1.153c0 .108-.11.176-.202.134L2.614 8.254a.503.503 0 0 0-.042-.028.147.147 0 0 1 0-.252.499.499 0 0 0 .042-.028l3.984-2.933zM7.8 10.386c.068 0 .143.003.223.006.434.02 1.034.086 1.7.271 1.326.368 2.896 1.202 3.94 3.08a.5.5 0 0 0 .933-.305c-.464-3.71-1.886-5.662-3.46-6.66-1.245-.79-2.527-.942-3.336-.971v-.66a1.144 1.144 0 0 0-1.767-.96l-3.994 2.94a1.147 1.147 0 0 0 0 1.946l3.994 2.94a1.144 1.144 0 0 0 1.767-.96v-.667z" }, null, -1);
const _hoisted_3$s = [
  _hoisted_2$u
];
function _sfc_render$a(_ctx, _cache) {
  return openBlock(), createElementBlock("svg", _hoisted_1$x, _hoisted_3$s);
}
const ReplyIcon = /* @__PURE__ */ _export_sfc(_sfc_main$y, [["render", _sfc_render$a]]);
const _sfc_main$x = {};
const _hoisted_1$w = {
  xmlns: "http://www.w3.org/2000/svg",
  width: "16",
  height: "16",
  fill: "currentColor",
  class: "bi bi-chat",
  viewBox: "0 0 16 16"
};
const _hoisted_2$t = /* @__PURE__ */ createBaseVNode("path", { d: "M2.678 11.894a1 1 0 0 1 .287.801 11 11 0 0 1-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 0 1 .71-.074A8 8 0 0 0 8 14c3.996 0 7-2.807 7-6s-3.004-6-7-6-7 2.808-7 6c0 1.468.617 2.83 1.678 3.894m-.493 3.905a22 22 0 0 1-.713.129c-.2.032-.352-.176-.273-.362a10 10 0 0 0 .244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9 9 0 0 1-2.347-.306c-.52.263-1.639.742-3.468 1.105" }, null, -1);
const _hoisted_3$r = [
  _hoisted_2$t
];
function _sfc_render$9(_ctx, _cache) {
  return openBlock(), createElementBlock("svg", _hoisted_1$w, _hoisted_3$r);
}
const ChatIcon = /* @__PURE__ */ _export_sfc(_sfc_main$x, [["render", _sfc_render$9]]);
const _hoisted_1$v = { class: "actions-bar" };
const _hoisted_2$s = { class: "actions-bar__action actions-bar__num" };
const _hoisted_3$q = { class: "actions_bar-number" };
const _hoisted_4$m = { class: "actions-bar__action actions-bar__num" };
const _hoisted_5$f = { class: "actions_bar-number" };
const _hoisted_6$d = { class: "actions_bar-number" };
const _sfc_main$w = /* @__PURE__ */ defineComponent({
  __name: "EventActionsBar",
  props: {
    likes: {},
    reposts: {},
    replies: {},
    hasReplyBtn: { type: Boolean }
  },
  emits: ["showReplyField", "handleShowReplies", "handleHideReplies"],
  setup(__props, { emit: __emit }) {
    const emit2 = __emit;
    const handleShowReplyField = () => {
      emit2("showReplyField");
    };
    const handleShowReplies = () => {
      emit2("handleShowReplies");
    };
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$v, [
        createBaseVNode("span", _hoisted_2$s, [
          createVNode(EmptyHeartIcon, { class: "actions-bar__icon" }),
          createBaseVNode("span", _hoisted_3$q, toDisplayString(_ctx.likes), 1)
        ]),
        createBaseVNode("span", _hoisted_4$m, [
          createVNode(ArrowRepeatIcon, { class: "actions-bar__icon" }),
          createBaseVNode("span", _hoisted_5$f, toDisplayString(_ctx.reposts), 1)
        ]),
        _ctx.hasReplyBtn ? (openBlock(), createElementBlock("span", {
          key: 0,
          onClick: handleShowReplies,
          class: "actions-bar__action actions-bar__num actions-bar__replies"
        }, [
          createVNode(ChatIcon, { class: "actions-bar__icon" }),
          createBaseVNode("span", _hoisted_6$d, toDisplayString(_ctx.replies), 1)
        ])) : createCommentVNode("", true),
        _ctx.hasReplyBtn ? (openBlock(), createElementBlock("span", {
          key: 1,
          onClick: handleShowReplyField,
          class: "actions-bar__action actions-bar__reply"
        }, [
          createVNode(ReplyIcon, { class: "actions-bar__icon" })
        ])) : createCommentVNode("", true)
      ]);
    };
  }
});
const EventActionsBar_vue_vue_type_style_index_0_lang = "";
const useNpub = defineStore("npub", () => {
  const npubInput = ref("");
  const cachedUrlNpub = ref("");
  function updateNpubInput(value) {
    npubInput.value = value;
  }
  function updateCachedUrl(value) {
    cachedUrlNpub.value = value;
  }
  return { npubInput, cachedUrlNpub, updateNpubInput, updateCachedUrl };
});
const useUser = defineStore("user", () => {
  const isRoutingUser = ref(false);
  function updateRoutingStatus(value) {
    isRoutingUser.value = value;
  }
  return { isRoutingUser, updateRoutingStatus };
});
const _hoisted_1$u = { class: "event-content" };
const _hoisted_2$r = { key: 0 };
const _hoisted_3$p = { key: 1 };
const _hoisted_4$l = ["onClick"];
const _sfc_main$v = /* @__PURE__ */ defineComponent({
  __name: "EventText",
  props: {
    event: {},
    slice: {}
  },
  setup(__props) {
    const props = __props;
    const router2 = useRouter();
    const npubStore = useNpub();
    const userStore = useUser();
    const contentParts = ref([]);
    onMounted(() => {
      contentParts.value = updateContentParts(props.event, props.slice);
    });
    onBeforeUpdate(() => {
      contentParts.value = updateContentParts(props.event, props.slice);
    });
    const sliceParts = (parts, sliceCount) => {
      let slicedParts = [];
      let str = "";
      for (const p2 of parts) {
        const startLength = str.length;
        str += p2.value;
        if (str.length <= sliceCount) {
          slicedParts.push(p2);
        } else {
          if (p2.type === "text") {
            const difference = sliceCount - startLength;
            p2.value = p2.value.slice(0, difference);
          }
          slicedParts.push(p2);
          slicedParts.push({ type: "text", value: "..." });
          break;
        }
      }
      return slicedParts;
    };
    const updateContentParts = (event, sliceContent) => {
      const rawContent = event.content;
      const references = event.references;
      let parts = [];
      if (!(references == null ? void 0 : references.length)) {
        parts.push({ type: "text", value: rawContent });
        return parts;
      }
      const cachedIndexes = [];
      references.forEach((ref2) => {
        let index = rawContent.indexOf(ref2.text);
        if (cachedIndexes.includes(index)) {
          for (const ci of cachedIndexes) {
            if (!cachedIndexes.includes(index))
              break;
            index = rawContent.indexOf(ref2.text, index + ref2.text.length);
          }
        }
        ref2.textIndex = index;
        cachedIndexes.push(index);
      });
      references.sort((a, b) => {
        return a.textIndex - b.textIndex;
      });
      let currentTextPart = rawContent;
      references.forEach((ref2) => {
        const currIndex = currentTextPart.indexOf(ref2.text);
        const part1 = currentTextPart.slice(0, currIndex);
        const part2 = currentTextPart.slice(currIndex + ref2.text.length);
        const name = getReferenceName(ref2);
        parts.push({ type: "text", value: part1 });
        parts.push({ type: "profile", value: name, npub: getNpub(ref2.profile.pubkey) });
        currentTextPart = part2;
      });
      parts.push({ type: "text", value: currentTextPart });
      if (sliceContent) {
        parts = sliceParts(parts, sliceContent);
      }
      return parts;
    };
    const getReferenceName = (reference) => {
      const details = reference.profile_details;
      const npub = getNpub(reference.profile.pubkey);
      const name = details.name || details.username || details.display_name || `${npub.slice(0, 15)}...`;
      return `@${name}`;
    };
    const getNpub = (pubkey) => {
      return nip19_exports.npubEncode(pubkey);
    };
    const handleClickMention = (mentionNpub) => {
      if (!mentionNpub)
        return;
      npubStore.updateNpubInput(mentionNpub);
      userStore.updateRoutingStatus(true);
      router2.push({ path: `/user/${mentionNpub}` });
    };
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$u, [
        (openBlock(true), createElementBlock(Fragment, null, renderList(contentParts.value, (part) => {
          return openBlock(), createElementBlock("span", null, [
            part.type === "text" ? (openBlock(), createElementBlock("span", _hoisted_2$r, toDisplayString(part.value), 1)) : createCommentVNode("", true),
            part.type === "profile" ? (openBlock(), createElementBlock("span", _hoisted_3$p, [
              createBaseVNode("a", {
                onClick: withModifiers(() => handleClickMention(part.npub), ["prevent"]),
                href: "#"
              }, toDisplayString(part.value), 9, _hoisted_4$l)
            ])) : createCommentVNode("", true)
          ]);
        }), 256))
      ]);
    };
  }
});
const EventText_vue_vue_type_style_index_0_scoped_2c0eedfd_lang = "";
const EventText = /* @__PURE__ */ _export_sfc(_sfc_main$v, [["__scopeId", "data-v-2c0eedfd"]]);
function isBytes(a) {
  return a instanceof Uint8Array || a != null && typeof a === "object" && a.constructor.name === "Uint8Array";
}
function bytes(b, ...lengths) {
  if (!isBytes(b))
    throw new Error("Uint8Array expected");
  if (lengths.length > 0 && !lengths.includes(b.length))
    throw new Error(`Uint8Array expected of length ${lengths}, not of length=${b.length}`);
}
function exists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function output(out, instance) {
  bytes(out);
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error(`digestInto() expects output buffer of length at least ${min}`);
  }
}
/*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
const createView = (arr) => new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
const rotr = (word, shift) => word << 32 - shift | word >>> shift;
new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
const hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i2) => i2.toString(16).padStart(2, "0"));
function bytesToHex(bytes$12) {
  bytes(bytes$12);
  let hex2 = "";
  for (let i2 = 0; i2 < bytes$12.length; i2++) {
    hex2 += hexes[bytes$12[i2]];
  }
  return hex2;
}
const asciis = { _0: 48, _9: 57, _A: 65, _F: 70, _a: 97, _f: 102 };
function asciiToBase16(char) {
  if (char >= asciis._0 && char <= asciis._9)
    return char - asciis._0;
  if (char >= asciis._A && char <= asciis._F)
    return char - (asciis._A - 10);
  if (char >= asciis._a && char <= asciis._f)
    return char - (asciis._a - 10);
  return;
}
function hexToBytes(hex2) {
  if (typeof hex2 !== "string")
    throw new Error("hex string expected, got " + typeof hex2);
  const hl = hex2.length;
  const al = hl / 2;
  if (hl % 2)
    throw new Error("padded hex string expected, got unpadded hex of length " + hl);
  const array = new Uint8Array(al);
  for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
    const n1 = asciiToBase16(hex2.charCodeAt(hi));
    const n2 = asciiToBase16(hex2.charCodeAt(hi + 1));
    if (n1 === void 0 || n2 === void 0) {
      const char = hex2[hi] + hex2[hi + 1];
      throw new Error('hex string expected, got non-hex character "' + char + '" at index ' + hi);
    }
    array[ai] = n1 * 16 + n2;
  }
  return array;
}
function utf8ToBytes(str) {
  if (typeof str !== "string")
    throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
  return new Uint8Array(new TextEncoder().encode(str));
}
function toBytes(data) {
  if (typeof data === "string")
    data = utf8ToBytes(data);
  bytes(data);
  return data;
}
class Hash3 {
  // Safe version that clones internal state
  clone() {
    return this._cloneInto();
  }
}
function wrapConstructor(hashCons) {
  const hashC = (msg) => hashCons().update(toBytes(msg)).digest();
  const tmp = hashCons();
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = () => hashCons();
  return hashC;
}
const useNsec = defineStore("nsec", () => {
  const nsec = ref("");
  const rememberMe = ref(false);
  const cachedNsec = ref("");
  function updateNsec(value) {
    nsec.value = value;
  }
  function updateCachedNsec(value) {
    cachedNsec.value = value;
  }
  function setRememberMe(value) {
    rememberMe.value = value;
  }
  function getPubkey() {
    try {
      const privKeyBytes = getPrivkeyBytes();
      if (!privKeyBytes) {
        throw new Error("Invalid private key");
      }
      return getPublicKey(privKeyBytes);
    } catch (e) {
      return "";
    }
  }
  function getPrivkeyBytes() {
    try {
      const isHex = nsec.value.indexOf("nsec") === -1;
      return isHex ? hexToBytes(nsec.value) : nip19_exports.decode(nsec.value).data;
    } catch (e) {
      return null;
    }
  }
  function getPrivkeyHex() {
    const bytes2 = getPrivkeyBytes();
    if (!bytes2) {
      return "";
    }
    try {
      return bytesToHex(bytes2);
    } catch (e) {
      return "";
    }
  }
  function getPrivkey() {
    try {
      const isHex = nsec.value.indexOf("nsec") === -1;
      return isHex ? nip19_exports.nsecEncode(hexToBytes(nsec.value)) : nsec.value;
    } catch (e) {
      return "";
    }
  }
  function isValidNsecPresented() {
    return nsec.value.length > 0 && isNsecValid();
  }
  function isNotValidNsecPresented() {
    return nsec.value.length > 0 && !isNsecValid();
  }
  function isNsecValid() {
    if (nsec.value.length === 0)
      return false;
    return getPubkey().length > 0;
  }
  const isNsecValidTemp = computed(() => {
    return isNsecValid();
  });
  return {
    nsec,
    updateNsec,
    rememberMe,
    setRememberMe,
    isNsecValid,
    isValidNsecPresented,
    isNotValidNsecPresented,
    getPubkey,
    cachedNsec,
    updateCachedNsec,
    getPrivkeyBytes,
    getPrivkeyHex,
    getPrivkey,
    isNsecValidTemp
  };
});
const useImages = defineStore("images", () => {
  const showImages = ref(false);
  function updateShowImages(value) {
    showImages.value = value;
  }
  return { showImages, updateShowImages };
});
const { normalizeURL: normalizeURL$1 } = utils_exports;
const useRelay = defineStore("relay", () => {
  const currentRelay = ref({});
  const isConnectingToRelay = ref(false);
  const selectInputRelayUrl = ref("");
  const selectInputCustomRelayUrl = ref("");
  const additionalRelaysCountForSignedEvent = ref(0);
  const additionalRelaysUrlsForSignedEvent = ref([]);
  const connectedUserReadRelayUrls = ref([]);
  const connectedUserWriteRelaysUrls = ref([]);
  const reedRelays = ref([]);
  const writeRelays = ref([]);
  const isConnectingToReadWriteRelays = ref(false);
  const isConnectedToReadWriteRelays = ref(false);
  const connectedFeedRelaysUrls = ref([]);
  const userDMRelaysUrls = ref([]);
  const userReadWriteRelays = computed(() => {
    const unique = /* @__PURE__ */ new Set([...reedRelays.value, ...writeRelays.value]);
    const read = [];
    const write = [];
    unique.forEach((r) => {
      if (reedRelays.value.includes(r) && !writeRelays.value.includes(r)) {
        read.push({ url: r, type: "read" });
      } else {
        write.push({ url: r, type: "write" });
      }
    });
    return [...read, ...write].sort((a, b) => a.url.localeCompare(b.url));
  });
  const connectedUserReadWriteUrlsWithSelectedRelay = computed(() => {
    const urls = /* @__PURE__ */ new Set([...connectedUserReadRelayUrls.value, ...connectedUserWriteRelaysUrls.value]);
    if (currentRelay.value.connected) {
      urls.add(currentRelay.value.url);
    }
    return [...urls];
  });
  const userChatRelaysUrls = computed(() => {
    return userDMRelaysUrls.value.length ? userDMRelaysUrls.value : connectedUserReadWriteUrlsWithSelectedRelay.value;
  });
  const userReadWriteRelaysUrls = computed(() => userReadWriteRelays.value.map((r) => r.url));
  const allRelaysUrlsWithSelectedRelay = computed(() => {
    const connected = currentRelay.value.url;
    const userRelays = userReadWriteRelaysUrls.value;
    return userRelays.includes(connected) ? userRelays : [connected, ...userRelays];
  });
  const connectedUserReadRelayUrlsWithSelectedRelay = computed(() => {
    const relays = connectedUserReadRelayUrls.value;
    const curRelay = currentRelay.value;
    if (curRelay.connected && !relays.includes(curRelay.url)) {
      relays.push(curRelay.url);
    }
    return relays;
  });
  const nip65Tags = computed(() => {
    const read = reedRelays.value;
    const write = writeRelays.value;
    const unique = /* @__PURE__ */ new Set([...read, ...write]);
    const tags = [];
    unique.forEach((r) => {
      if (read.includes(r) && write.includes(r)) {
        tags.push(["r", r]);
      } else if (read.includes(r)) {
        tags.push(["r", r, "read"]);
      } else if (write.includes(r)) {
        tags.push(["r", r, "write"]);
      }
    });
    return tags;
  });
  const connectedFeedRelaysPrettyStr = computed(() => {
    return connectedFeedRelaysUrls.value.map((r) => r.replace("wss://", "").replace("/", "")).join(", ");
  });
  const isConnectedToRelay = computed(() => {
    return currentRelay.value.connected;
  });
  function updateCurrentRelay(value) {
    currentRelay.value = value;
  }
  function setConnectionToRelayStatus(value) {
    isConnectingToRelay.value = value;
  }
  function setConnectedUserReadRelayUrls(value) {
    connectedUserReadRelayUrls.value = value.map((r) => normalizeURL$1(r));
  }
  function setConnectedUserWriteRelayUrls(value) {
    connectedUserWriteRelaysUrls.value = value.map((r) => normalizeURL$1(r));
  }
  function setConnectedFeedRelayUrls(value) {
    connectedFeedRelaysUrls.value = value.map((r) => normalizeURL$1(r));
  }
  function setReedRelays(value) {
    reedRelays.value = value.map((r) => normalizeURL$1(r));
  }
  function setWriteRelays(value) {
    writeRelays.value = value.map((r) => normalizeURL$1(r));
  }
  function addWriteRelay(value) {
    if (writeRelays.value.includes(value))
      return;
    writeRelays.value.push(normalizeURL$1(value));
  }
  function addUserRelay(relay) {
    const url = normalizeURL$1(relay);
    if (!url)
      return false;
    if (userReadWriteRelaysUrls.value.includes(url))
      return false;
    reedRelays.value.push(url);
  }
  function removeWriteRelay(value) {
    writeRelays.value = writeRelays.value.filter((r) => r !== value);
  }
  function removeUserRelay(value) {
    reedRelays.value = reedRelays.value.filter((r) => r !== value);
    writeRelays.value = writeRelays.value.filter((r) => r !== value);
    connectedUserReadRelayUrls.value = connectedUserReadRelayUrls.value.filter((r) => r !== value);
  }
  function setSelectedRelay(value) {
    selectInputRelayUrl.value = value === "custom" ? "custom" : normalizeURL$1(value);
  }
  function updateAdditionalRelaysCountForSignedEvent(value) {
    additionalRelaysCountForSignedEvent.value = value;
  }
  function updateRelayAdditionalRelaysUrlsForSignedEvent(index, value) {
    additionalRelaysUrlsForSignedEvent.value[index] = value.length ? normalizeURL$1(value) : "";
  }
  function setIsConnectingToReadWriteRelaysStatus(value) {
    isConnectingToReadWriteRelays.value = value;
  }
  function setIsConnectedToReadWriteRelaysStatus(value) {
    isConnectedToReadWriteRelays.value = value;
  }
  function setUserDMRelaysUrls(value) {
    userDMRelaysUrls.value = value.map((r) => normalizeURL$1(r));
  }
  return {
    isConnectingToRelay,
    setConnectionToRelayStatus,
    connectedUserReadRelayUrls,
    setConnectedUserReadRelayUrls,
    selectInputRelayUrl,
    setSelectedRelay,
    selectInputCustomRelayUrl,
    currentRelay,
    updateCurrentRelay,
    additionalRelaysCountForSignedEvent,
    updateAdditionalRelaysCountForSignedEvent,
    additionalRelaysUrlsForSignedEvent,
    updateRelayAdditionalRelaysUrlsForSignedEvent,
    connectedFeedRelaysPrettyStr,
    reedRelays,
    writeRelays,
    setReedRelays,
    setWriteRelays,
    isConnectedToRelay,
    userReadWriteRelays,
    removeWriteRelay,
    addWriteRelay,
    removeUserRelay,
    addUserRelay,
    nip65Tags,
    userReadWriteRelaysUrls,
    allRelaysUrlsWithSelectedRelay,
    connectedFeedRelaysUrls,
    setConnectedFeedRelayUrls,
    connectedUserReadRelayUrlsWithSelectedRelay,
    isConnectingToReadWriteRelays,
    setIsConnectingToReadWriteRelaysStatus,
    setConnectedUserWriteRelayUrls,
    connectedUserWriteRelaysUrls,
    connectedUserReadWriteUrlsWithSelectedRelay,
    setIsConnectedToReadWriteRelaysStatus,
    isConnectedToReadWriteRelays,
    userChatRelaysUrls,
    setUserDMRelaysUrls
  };
});
const EVENT_KIND = {
  META: 0,
  REPLY: 1,
  LIKE: 7,
  REPOST: 6,
  DM_RELAYS: 10050,
  GIFT_WRAP: 1059,
  RELAY_LIST_META: 10002
};
const PURPLEPAG_RELAY_URL = "wss://purplepag.es/";
const injectDataToRootNotes = async (posts, relays = [], relaysPool, metaCache) => {
  const likes = injectLikesToNotes(posts, relays, relaysPool);
  const reposts = injectRepostsToNotes(posts, relays, relaysPool);
  const references = injectReferencesToNotes(posts, relays, relaysPool, metaCache);
  const replies = injectRootRepliesToNotes(posts, relays, relaysPool);
  posts.forEach((post) => post.isRoot = true);
  return Promise.all([likes, reposts, references, replies]);
};
const injectRootLikesRepostsRepliesCount = (post, events = []) => {
  if (!events || !events.length) {
    events = [];
  }
  const likes = [];
  const reposts = [];
  const replies = [];
  for (const event of events) {
    switch (event.kind) {
      case EVENT_KIND.LIKE:
        likes.push(event);
        break;
      case EVENT_KIND.REPOST:
        reposts.push(event);
        break;
      case EVENT_KIND.REPLY:
        replies.push(event);
        break;
    }
  }
  injectLikesToNote(post, likes);
  injectRepostsToNote(post, reposts);
  injectRootRepliesToNote(post, replies);
};
const injectDataToReplyNotes = async (replyingToEvent, posts, relays = [], relaysPool) => {
  const likes = injectLikesToNotes(posts, relays, relaysPool);
  const reposts = injectRepostsToNotes(posts, relays, relaysPool);
  const references = injectReferencesToNotes(posts, relays, relaysPool);
  const replies = injectNotRootRepliesToNotes(posts, relays, relaysPool);
  posts.forEach((post) => post.isRoot = false);
  if (replyingToEvent) {
    injectReplyingToDataToNotes(replyingToEvent, posts);
  }
  return Promise.all([likes, reposts, references, replies]);
};
const injectReplyingToDataToNotes = (replyingToEvent, postsEvents) => {
  for (const event of postsEvents) {
    event.replyingTo = {
      user: replyingToEvent.author,
      pubkey: replyingToEvent.pubkey,
      event: replyingToEvent
    };
  }
};
const injectRootRepliesToNotes = async (postsEvents, relays = [], relaysPool) => {
  var _a;
  if (!relays.length)
    return postsEvents;
  const pool = relaysPool || new SimplePool();
  const postsIds = postsEvents.map((e) => e.id);
  const repliesEvents = await pool.querySync(relays, { kinds: [1], "#e": postsIds });
  for (const event of postsEvents) {
    let replies = 0;
    for (const reply of repliesEvents) {
      const nip10Data = nip10_exports.parse(reply);
      if (!nip10Data.reply && ((_a = nip10Data == null ? void 0 : nip10Data.root) == null ? void 0 : _a.id) === event.id) {
        replies++;
      }
    }
    event.replies = replies;
  }
};
const injectRootRepliesToNote = async (postEvent, repliesEvents) => {
  var _a;
  let replies = 0;
  for (const reply of repliesEvents) {
    const nip10Data = nip10_exports.parse(reply);
    if (!nip10Data.reply && ((_a = nip10Data == null ? void 0 : nip10Data.root) == null ? void 0 : _a.id) === postEvent.id) {
      replies++;
    }
  }
  postEvent.replies = replies;
};
const injectNotRootRepliesToNotes = async (postsEvents, relays = [], relaysPool) => {
  var _a;
  if (!relays.length)
    return postsEvents;
  const pool = relaysPool || new SimplePool();
  const postsIds = postsEvents.map((e) => e.id);
  const repliesEvents = await pool.querySync(relays, { kinds: [1], "#e": postsIds });
  for (const event of postsEvents) {
    let replies = 0;
    for (const reply of repliesEvents) {
      const nip10Data = nip10_exports.parse(reply);
      if (((_a = nip10Data == null ? void 0 : nip10Data.reply) == null ? void 0 : _a.id) === event.id) {
        replies++;
      }
    }
    event.replies = replies;
  }
};
const injectAuthorsToNotes = (postsEvents, authorsEvents) => {
  const tempPostsEvents = [...postsEvents];
  const postsWithAuthor = [];
  tempPostsEvents.forEach((pe) => {
    let isAuthorAddedToPost = false;
    authorsEvents.forEach((ae) => {
      if (!isAuthorAddedToPost && pe.pubkey === (ae == null ? void 0 : ae.pubkey)) {
        const tempEventWithAuthor = pe;
        tempEventWithAuthor.author = JSON.parse(ae.content);
        tempEventWithAuthor.authorEvent = ae;
        postsWithAuthor.push(tempEventWithAuthor);
        isAuthorAddedToPost = true;
      }
    });
    if (!isAuthorAddedToPost) {
      postsWithAuthor.push(pe);
    }
  });
  return postsWithAuthor;
};
const injectReferencesToNotes = async (postsEvents, relays = [], relaysPool, metaCache) => {
  var _a;
  if (!relays.length)
    return postsEvents;
  let pool = relaysPool || new SimplePool();
  const eventsReferences = {};
  const allReferencesPubkeys = /* @__PURE__ */ new Set();
  for (const event of postsEvents) {
    if (!contentHasMentions(event.content)) {
      continue;
    }
    const references = parseReferences(event);
    for (let i2 = 0; i2 < references.length; i2++) {
      let { profile } = references[i2];
      if (!(profile == null ? void 0 : profile.pubkey))
        continue;
      allReferencesPubkeys.add(profile.pubkey);
    }
    eventsReferences[event.id] = references;
  }
  if (!allReferencesPubkeys.size) {
    postsEvents.forEach((p2) => p2.references = []);
    return;
  }
  const cachedMetas = [];
  let pubkeysToDownload = [];
  if (metaCache) {
    for (const pubkey of allReferencesPubkeys) {
      const meta = (_a = metaCache[pubkey]) == null ? void 0 : _a.event;
      if (meta) {
        cachedMetas.push(meta);
      } else {
        pubkeysToDownload.push(pubkey);
      }
    }
  } else {
    pubkeysToDownload = [...allReferencesPubkeys];
  }
  const newMetas = await Promise.all(
    pubkeysToDownload.map(async (pubkey) => {
      return pool.get(relays, { kinds: [0], authors: [pubkey] });
    })
  );
  const metas = [...cachedMetas, ...newMetas].sort((a, b) => b.created_at - a.created_at);
  for (const event of postsEvents) {
    const references = eventsReferences[event.id];
    if (!references) {
      event.references = [];
      continue;
    }
    const referencesToInject = [];
    for (let i2 = 0; i2 < references.length; i2++) {
      let { profile } = references[i2];
      if (!(profile == null ? void 0 : profile.pubkey))
        continue;
      metas.forEach((meta) => {
        if ((meta == null ? void 0 : meta.pubkey) === profile.pubkey) {
          const referenceWithProfile = references[i2];
          referenceWithProfile.profile_details = JSON.parse((meta == null ? void 0 : meta.content) || "{}");
          referencesToInject.push(referenceWithProfile);
        }
      });
    }
    event.references = referencesToInject;
  }
};
const getNoteReferences = (postEvent) => {
  if (!contentHasMentions(postEvent.content)) {
    return [];
  }
  const allReferencesPubkeys = /* @__PURE__ */ new Set();
  const references = parseReferences(postEvent);
  for (let i2 = 0; i2 < references.length; i2++) {
    let { profile } = references[i2];
    if (!(profile == null ? void 0 : profile.pubkey))
      continue;
    allReferencesPubkeys.add(profile.pubkey);
  }
  if (!allReferencesPubkeys.size) {
    return [];
  }
  return [...allReferencesPubkeys];
};
const injectReferencesToNote = async (postEvent, referencesMetas) => {
  if (!referencesMetas.length) {
    postEvent.references = [];
    return;
  }
  const references = parseReferences(postEvent);
  const referencesToInject = [];
  for (let i2 = 0; i2 < references.length; i2++) {
    let { profile } = references[i2];
    if (!(profile == null ? void 0 : profile.pubkey))
      continue;
    referencesMetas.forEach((meta) => {
      if ((meta == null ? void 0 : meta.pubkey) === (profile == null ? void 0 : profile.pubkey)) {
        const referenceWithProfile = references[i2];
        referenceWithProfile.profile_details = JSON.parse((meta == null ? void 0 : meta.content) || "{}");
        referencesToInject.push(referenceWithProfile);
      }
    });
  }
  postEvent.references = referencesToInject;
};
const filterMetas = (metas) => {
  const cache = /* @__PURE__ */ new Set();
  const filteredMetas = [];
  const sortedMetas = metas.sort((a, b) => b.created_at - a.created_at);
  sortedMetas.forEach((meta) => {
    const { pubkey } = meta;
    if (cache.has(pubkey))
      return;
    cache.add(pubkey);
    filteredMetas.push(meta);
  });
  return filteredMetas;
};
const injectLikesToNotes = async (postsEvents, relays = [], relaysPool) => {
  if (!relays.length)
    return postsEvents;
  const postsIds = postsEvents.map((e) => e.id);
  const pool = relaysPool || new SimplePool();
  const likeEvents = await pool.querySync(relays, { kinds: [7], "#e": postsIds });
  postsEvents.forEach((postEvent) => {
    let likes = 0;
    likeEvents.forEach((likedEvent) => {
      var _a;
      const likedEventId = (_a = likedEvent.tags.reverse().find((tag) => tag[0] === "e")) == null ? void 0 : _a[1];
      if (likedEventId && likedEventId === postEvent.id && likedEvent.content && isLike(likedEvent.content)) {
        likes++;
      }
    });
    postEvent.likes = likes;
  });
};
const injectLikesToNote = (postEvent, likesEvents) => {
  let likes = 0;
  likesEvents.forEach((likedEvent) => {
    var _a;
    const likedEventId = (_a = likedEvent.tags.reverse().find((tag) => tag[0] === "e")) == null ? void 0 : _a[1];
    if (likedEventId && likedEventId === postEvent.id && likedEvent.content && isLike(likedEvent.content)) {
      likes++;
    }
  });
  postEvent.likes = likes;
};
const injectRepostsToNotes = async (postsEvents, relays = [], relaysPool) => {
  if (!relays.length)
    return postsEvents;
  const postsIds = postsEvents.map((e) => e.id);
  const pool = relaysPool || new SimplePool();
  const repostEvents = await pool.querySync(relays, { kinds: [6], "#e": postsIds });
  postsEvents.forEach((postEvent) => {
    let reposts = 0;
    repostEvents.forEach((repostEvent) => {
      var _a;
      const repostEventId = (_a = repostEvent.tags.find((tag) => tag[0] === "e")) == null ? void 0 : _a[1];
      if (repostEventId && repostEventId === postEvent.id) {
        reposts++;
      }
    });
    postEvent.reposts = reposts;
  });
};
const injectRepostsToNote = (postEvent, repostEvents) => {
  let reposts = 0;
  repostEvents.forEach((repostEvent) => {
    var _a;
    const repostEventId = (_a = repostEvent.tags.find((tag) => tag[0] === "e")) == null ? void 0 : _a[1];
    if (repostEventId && repostEventId === postEvent.id) {
      reposts++;
    }
  });
  postEvent.reposts = reposts;
};
const filterRootEventReplies = (event, replies) => {
  return replies.filter((reply) => {
    var _a;
    const nip10Data = nip10_exports.parse(reply);
    return !nip10Data.reply && ((_a = nip10Data == null ? void 0 : nip10Data.root) == null ? void 0 : _a.id) === event.id;
  });
};
const filterReplyEventReplies = (event, replies) => {
  return replies.filter((reply) => {
    var _a, _b;
    const nip10Data = nip10_exports.parse(reply);
    return ((_a = nip10Data == null ? void 0 : nip10Data.reply) == null ? void 0 : _a.id) === event.id || ((_b = nip10Data == null ? void 0 : nip10Data.root) == null ? void 0 : _b.id) === event.id;
  });
};
const contentHasMentions = (content) => {
  return content.indexOf("nostr:npub") !== -1 || content.indexOf("nostr:nprofile1") !== -1;
};
const isLike = (content) => {
  if (["-", "👎"].includes(content)) {
    return false;
  }
  return true;
};
const isWsAvailable = (url, timeout = 3e3) => {
  try {
    return new Promise((resolve2) => {
      const socket = new WebSocket(url);
      const timer = setTimeout(() => {
        socket.close();
        resolve2(false);
      }, timeout);
      socket.onopen = () => {
        clearTimeout(timer);
        socket.close();
        resolve2(true);
      };
      socket.onerror = () => {
        clearTimeout(timer);
        socket.close();
        resolve2(false);
      };
    });
  } catch (error) {
    return Promise.resolve(false);
  }
};
const isSHA256Hex = (hex2) => {
  return /^[a-f0-9]{64}$/.test(hex2);
};
const relayGet = (relay, filters, timeout) => {
  const timout = new Promise((resolve2) => {
    setTimeout(() => {
      resolve2(null);
    }, timeout);
  });
  const connection = new Promise((resolve2) => {
    const sub = relay.subscribe(filters, {
      onevent(event) {
        resolve2(event);
      },
      oneose() {
        sub.close();
      }
    });
  });
  return Promise.race([connection, timout]);
};
const parseRelaysNip65 = (event) => {
  const { tags } = event;
  const relays = { read: [], write: [], all: [] };
  if (!tags.length)
    return relays;
  tags.forEach((tag) => {
    const isRelay = tag[0] === "r";
    if (isRelay) {
      const relayUrl = utils_exports.normalizeURL(tag[1]);
      const relayType = tag[2];
      if (!relayType) {
        relays.read.push(relayUrl);
        relays.write.push(relayUrl);
      } else if (relayType === "read") {
        relays.read.push(relayUrl);
      } else if (relayType === "write") {
        relays.write.push(relayUrl);
      }
      relays.all.push({ url: relayUrl, type: relayType || "write" });
    }
  });
  return relays;
};
const publishEventToRelays = async (relays, pool, event) => {
  const promises = relays.map(async (relay) => {
    const promises2 = await pool.publish([relay], event);
    const result = (await Promise.allSettled(promises2))[0];
    return {
      relay,
      success: result.status === "fulfilled"
    };
  });
  return await Promise.all(promises);
};
const formatedDate = (date) => {
  return new Date(date * 1e3).toLocaleString("default", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "numeric"
  });
};
const formatedDateYear = (date) => {
  return new Date(date * 1e3).toLocaleString("default", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "numeric"
  });
};
const racePromises = (promises, handleSuccess, handleError2) => {
  if (promises.length === 0)
    return;
  const wrappedPromises = promises.map(
    (p2) => p2.then((result) => ({ result, isFulfilled: true, originalPromise: p2 })).catch((error) => ({ result: error, isFulfilled: false, originalPromise: p2 }))
  );
  Promise.race(wrappedPromises).then(({ result, isFulfilled, originalPromise }) => {
    if (isFulfilled) {
      handleSuccess(result);
    } else {
      handleError2(result);
    }
    const remainingPromises = promises.filter((p2) => p2 !== originalPromise);
    racePromises(remainingPromises, handleSuccess, handleError2);
  });
};
const _sfc_main$u = {};
const _hoisted_1$t = {
  xmlns: "http://www.w3.org/2000/svg",
  width: "22",
  height: "22",
  fill: "currentColor",
  class: "bi bi-link-45deg",
  viewBox: "0 0 16 16"
};
const _hoisted_2$q = /* @__PURE__ */ createBaseVNode("path", { d: "M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1 1 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4 4 0 0 1-.128-1.287z" }, null, -1);
const _hoisted_3$o = /* @__PURE__ */ createBaseVNode("path", { d: "M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243z" }, null, -1);
const _hoisted_4$k = [
  _hoisted_2$q,
  _hoisted_3$o
];
function _sfc_render$8(_ctx, _cache) {
  return openBlock(), createElementBlock("svg", _hoisted_1$t, _hoisted_4$k);
}
const LinkIcon = /* @__PURE__ */ _export_sfc(_sfc_main$u, [["render", _sfc_render$8]]);
const _sfc_main$t = {};
const _hoisted_1$s = {
  xmlns: "http://www.w3.org/2000/svg",
  width: "22",
  height: "22",
  fill: "currentColor",
  class: "bi bi-check2",
  viewBox: "0 0 16 16"
};
const _hoisted_2$p = /* @__PURE__ */ createBaseVNode("path", { d: "M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0" }, null, -1);
const _hoisted_3$n = [
  _hoisted_2$p
];
function _sfc_render$7(_ctx, _cache) {
  return openBlock(), createElementBlock("svg", _hoisted_1$s, _hoisted_3$n);
}
const CheckIcon = /* @__PURE__ */ _export_sfc(_sfc_main$t, [["render", _sfc_render$7]]);
const _sfc_main$s = {};
const _hoisted_1$r = {
  xmlns: "http://www.w3.org/2000/svg",
  width: "18",
  height: "18",
  fill: "currentColor",
  class: "bi bi-check-square",
  viewBox: "0 0 16 16"
};
const _hoisted_2$o = /* @__PURE__ */ createBaseVNode("path", { d: "M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2z" }, null, -1);
const _hoisted_3$m = /* @__PURE__ */ createBaseVNode("path", { d: "M10.97 4.97a.75.75 0 0 1 1.071 1.05l-3.992 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425z" }, null, -1);
const _hoisted_4$j = [
  _hoisted_2$o,
  _hoisted_3$m
];
function _sfc_render$6(_ctx, _cache) {
  return openBlock(), createElementBlock("svg", _hoisted_1$r, _hoisted_4$j);
}
const CheckSquareIcon = /* @__PURE__ */ _export_sfc(_sfc_main$s, [["render", _sfc_render$6]]);
const _sfc_main$r = {};
const _hoisted_1$q = {
  xmlns: "http://www.w3.org/2000/svg",
  width: "16",
  height: "16",
  fill: "currentColor",
  class: "bi bi-diagram-2-fill",
  viewBox: "0 0 16 16"
};
const _hoisted_2$n = /* @__PURE__ */ createBaseVNode("path", {
  "fill-rule": "evenodd",
  d: "M6 3.5A1.5 1.5 0 0 1 7.5 2h1A1.5 1.5 0 0 1 10 3.5v1A1.5 1.5 0 0 1 8.5 6v1H11a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0V8h-5v.5a.5.5 0 0 1-1 0v-1A.5.5 0 0 1 5 7h2.5V6A1.5 1.5 0 0 1 6 4.5zm-3 8A1.5 1.5 0 0 1 4.5 10h1A1.5 1.5 0 0 1 7 11.5v1A1.5 1.5 0 0 1 5.5 14h-1A1.5 1.5 0 0 1 3 12.5zm6 0a1.5 1.5 0 0 1 1.5-1.5h1a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1-1.5 1.5h-1A1.5 1.5 0 0 1 9 12.5z"
}, null, -1);
const _hoisted_3$l = [
  _hoisted_2$n
];
function _sfc_render$5(_ctx, _cache) {
  return openBlock(), createElementBlock("svg", _hoisted_1$q, _hoisted_3$l);
}
const ThreadIcon = /* @__PURE__ */ _export_sfc(_sfc_main$r, [["render", _sfc_render$5]]);
const _sfc_main$q = {};
const _hoisted_1$p = {
  xmlns: "http://www.w3.org/2000/svg",
  width: "18",
  height: "18",
  fill: "currentColor",
  class: "bi bi-exclamation-octagon",
  viewBox: "0 0 16 16"
};
const _hoisted_2$m = /* @__PURE__ */ createBaseVNode("path", { d: "M4.54.146A.5.5 0 0 1 4.893 0h6.214a.5.5 0 0 1 .353.146l4.394 4.394a.5.5 0 0 1 .146.353v6.214a.5.5 0 0 1-.146.353l-4.394 4.394a.5.5 0 0 1-.353.146H4.893a.5.5 0 0 1-.353-.146L.146 11.46A.5.5 0 0 1 0 11.107V4.893a.5.5 0 0 1 .146-.353zM5.1 1 1 5.1v5.8L5.1 15h5.8l4.1-4.1V5.1L10.9 1z" }, null, -1);
const _hoisted_3$k = /* @__PURE__ */ createBaseVNode("path", { d: "M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0M7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0z" }, null, -1);
const _hoisted_4$i = [
  _hoisted_2$m,
  _hoisted_3$k
];
function _sfc_render$4(_ctx, _cache) {
  return openBlock(), createElementBlock("svg", _hoisted_1$p, _hoisted_4$i);
}
const InvalidSignatureIcon = /* @__PURE__ */ _export_sfc(_sfc_main$q, [["render", _sfc_render$4]]);
const _hoisted_1$o = { class: "thread" };
const _hoisted_2$l = {
  key: 0,
  class: "loading-thread"
};
const _hoisted_3$j = { class: "event-card" };
const _hoisted_4$h = {
  key: 0,
  class: "event-img"
};
const _hoisted_5$e = ["src", "title"];
const _hoisted_6$c = { class: "event-content" };
const _hoisted_7$9 = { class: "event-header" };
const _hoisted_8$8 = ["href"];
const _hoisted_9$8 = { class: "event-username-text" };
const _hoisted_10$8 = {
  key: 0,
  class: "event-replying-to"
};
const _hoisted_11$6 = {
  key: 1,
  class: "replying-to-separator"
};
const _hoisted_12$6 = ["href"];
const _hoisted_13$5 = { class: "event-body" };
const _hoisted_14$5 = { class: "event-footer" };
const _hoisted_15$5 = { class: "event-footer__right-actions" };
const _hoisted_16$5 = { class: "event-footer__link-wrapper" };
const _hoisted_17$5 = { class: "event__raw-data" };
const _hoisted_18$2 = { class: "event-footer-code-wrapper" };
const _hoisted_19$2 = { class: "event-footer__signature-text" };
const _hoisted_20$2 = { class: "event-footer__right-actions" };
const _hoisted_21$2 = { class: "event-footer__link-wrapper" };
const _hoisted_22$2 = {
  key: 0,
  class: "reply-field"
};
const _hoisted_23$2 = { class: "reply-field__actions" };
const _hoisted_24$2 = { class: "reply-field__error" };
const _hoisted_25$2 = ["disabled"];
const _hoisted_26$2 = {
  key: 1,
  class: "loading-replies"
};
const _hoisted_27$2 = {
  key: 2,
  class: "replies"
};
const _sfc_main$p = /* @__PURE__ */ defineComponent({
  __name: "EventContent",
  props: {
    event: {},
    pool: {},
    pubKey: {},
    index: {},
    hasReplyBtn: { type: Boolean },
    isMainEvent: { type: Boolean },
    currentReadRelays: {},
    threadDescender: {}
  },
  emits: [
    "toggleRawData",
    "showReplyField",
    "loadRootReplies",
    "resetSentStatus",
    "loadMoreReplies"
  ],
  setup(__props, { emit: __emit }) {
    const emit2 = __emit;
    const replyText = ref("");
    const msgErr = ref("");
    const props = __props;
    const router2 = useRouter();
    const npubStore = useNpub();
    const nsecStore = useNsec();
    const userStore = useUser();
    const imagesStore = useImages();
    const relayStore = useRelay();
    const showReplyField = ref(false);
    const isPublishingReply = ref(false);
    const eventReplies = ref([]);
    const showReplies = ref(false);
    const isCopiedEventLink = ref(false);
    const isSigVerified = ref(false);
    const isLoadingReplies = ref(false);
    const ancestorsEvents = ref([]);
    const isLoadingThread = ref(false);
    const handleToggleRawData = (eventId) => {
      if (props.isMainEvent) {
        return emit2("toggleRawData", eventId);
      }
      props.event.showRawData = !props.event.showRawData;
    };
    const getUserPath = (pubkey) => {
      return `/user/${nip19_exports.npubEncode(pubkey)}`;
    };
    onMounted(() => {
      if (Object.keys(props.event).length === 0)
        return;
      isSigVerified.value = verifyEvent(props.event);
    });
    const displayName = (author, pubkey) => {
      if (author) {
        let name = "";
        if (author.name) {
          name = author.name;
        } else if (author.username) {
          name = author.username;
        } else {
          name = author.display_name;
        }
        if (name.length) {
          return name;
        }
      }
      return nip19_exports.npubEncode(pubkey).slice(0, 10) + "...";
    };
    const handleToggleReplyField = () => {
      showReplyField.value = !showReplyField.value;
      emit2("showReplyField");
    };
    const handleSendReply = async () => {
      if (isPublishingReply.value)
        return;
      const nsecValue = nsecStore.nsec ? nsecStore.nsec.trim() : "";
      if (!nsecValue.length) {
        msgErr.value = "Please provide your private key or generate random key.";
        return;
      }
      const messageValue = replyText.value.trim();
      if (!messageValue.length) {
        msgErr.value = "Please provide message to broadcast.";
        return;
      }
      let privkey;
      let pubkey;
      try {
        privkey = nsecStore.getPrivkeyBytes();
        if (!privkey) {
          throw new Error();
        }
        pubkey = nsecStore.getPubkey();
        if (!pubkey.length) {
          throw new Error();
        }
      } catch (e) {
        msgErr.value = `Invalid private key. Please check it and try again.`;
        return;
      }
      const writeRelays = relayStore.writeRelays;
      if (!writeRelays.length) {
        msgErr.value = "Please provide your write relays to broadcast event";
        return;
      }
      const event = {
        kind: 1,
        pubkey,
        created_at: Math.floor(Date.now() / 1e3),
        content: messageValue,
        tags: [],
        id: "",
        sig: ""
      };
      const existedETags = [];
      const existedPTags = [];
      props.event.tags.forEach((tag) => {
        const tempTag = [tag[0], tag[1]];
        if (tag[2])
          tempTag.push(tag[2]);
        if (tag[3])
          tempTag.push(tag[3]);
        if (tempTag[0] === "e") {
          existedETags.push(tempTag);
        } else if (tempTag[0] === "p") {
          existedPTags.push(tempTag);
        }
      });
      const eTagsForReply = [];
      if (existedETags.length) {
        const root = existedETags.find((tag) => tag[3] === "root");
        if (root) {
          eTagsForReply.push(root);
        } else {
          eTagsForReply.push(existedETags[0]);
        }
        eTagsForReply.push(["e", props.event.id, "", "reply"]);
      } else {
        eTagsForReply.push(["e", props.event.id, "", "root"]);
      }
      const msgReferences = parseReferences(event);
      const existedPubKeys = existedPTags.map((tag) => tag[1]);
      const pTagsFromOurMsg = [];
      msgReferences.forEach((ref2) => {
        var _a;
        const refPubkey = (_a = ref2 == null ? void 0 : ref2.profile) == null ? void 0 : _a.pubkey;
        if (refPubkey && !existedPubKeys.includes(refPubkey)) {
          pTagsFromOurMsg.push(["p", refPubkey]);
          existedPubKeys.push(refPubkey);
        }
      });
      const pTagsForReply = [...pTagsFromOurMsg, ...existedPTags];
      if (!existedPubKeys.includes(props.event.pubkey)) {
        pTagsForReply.push(["p", props.event.pubkey]);
      }
      event.tags = [...pTagsForReply, ...eTagsForReply];
      const signedEvent = finalizeEvent(event, privkey);
      msgErr.value = "";
      isPublishingReply.value = true;
      const pubkeysMentions = pTagsForReply.filter((tag) => tag[1] !== pubkey).map((tag) => tag[1]);
      let additionalRelays = [];
      const { pool } = props;
      if (pubkeysMentions.length) {
        const allRelays = [...relayStore.reedRelays, ...relayStore.writeRelays, relayStore.currentRelay.url];
        const relays = [...new Set(allRelays)];
        const metaEvents = await pool.querySync(relays, { kinds: [10002], authors: pubkeysMentions });
        const mentionsReadRelays = /* @__PURE__ */ new Set();
        metaEvents.forEach((event2) => {
          if (event2.tags.length) {
            const { read } = parseRelaysNip65(event2);
            read.forEach((r) => {
              if (relayStore.writeRelays.includes(r))
                return;
              mentionsReadRelays.add(r);
            });
          }
        });
        additionalRelays = [...mentionsReadRelays];
      }
      const result = await publishEventToRelays(writeRelays, pool, signedEvent);
      const hasSuccess = result.some((data) => data.success);
      if (!hasSuccess) {
        msgErr.value = "Failed to broadcast reply";
        return;
      }
      if (additionalRelays.length) {
        try {
          await pool.publish(additionalRelays, signedEvent);
        } catch (e) {
          console.error("Failed to broadcast reply to some additional relays");
        }
      }
      isPublishingReply.value = false;
      showReplyField.value = false;
      replyText.value = "";
      if (props.isMainEvent) {
        return emit2("loadRootReplies");
      }
      handleLoadReplies();
    };
    const handleLoadReplies = async () => {
      const { event, currentReadRelays, pool } = props;
      if (!(currentReadRelays == null ? void 0 : currentReadRelays.length) || !pool)
        return;
      if (props.isMainEvent) {
        return emit2("loadMoreReplies");
      }
      isLoadingReplies.value = true;
      let replies = await pool.querySync(currentReadRelays, { kinds: [1], "#e": [event.id] });
      if (event.isRoot) {
        replies = filterRootEventReplies(event, replies);
      } else {
        replies = filterReplyEventReplies(event, replies);
      }
      const descender = props.threadDescender;
      if (replies.length == 1 && (descender == null ? void 0 : descender.id) === replies[0].id) {
        isLoadingReplies.value = false;
        return;
      }
      const authors = replies.map((e) => e.pubkey);
      const uniqueAuthors = [...new Set(authors)];
      const authorsEvents = await pool.querySync(currentReadRelays, { kinds: [0], authors: uniqueAuthors });
      replies = injectAuthorsToNotes(replies, authorsEvents);
      await injectDataToReplyNotes(event, replies, currentReadRelays, pool);
      eventReplies.value = replies;
      showReplies.value = true;
      isLoadingReplies.value = false;
    };
    const handleHideReplies = () => {
      showReplies.value = false;
    };
    const handleCopyEventLink = () => {
      const { origin, pathname } = window.location;
      let noteId = nip19_exports.noteEncode(props.event.id);
      const eventLink = `${origin}${pathname}#/event/${noteId}`;
      navigator.clipboard.writeText(eventLink);
      isCopiedEventLink.value = true;
      setTimeout(() => {
        isCopiedEventLink.value = false;
      }, 2e3);
    };
    const handleUserClick = (pubkey) => {
      const urlNpub = nip19_exports.npubEncode(pubkey);
      npubStore.updateNpubInput(urlNpub);
      userStore.updateRoutingStatus(true);
      router2.push({ path: getUserPath(pubkey) });
    };
    const getAncestorsEventsChain = async (event) => {
      var _a, _b;
      const { currentReadRelays, pool } = props;
      if (!(currentReadRelays == null ? void 0 : currentReadRelays.length) || !pool)
        return [];
      const nip10Data = nip10_exports.parse(event);
      if (!nip10Data.root && !nip10Data.reply)
        return [];
      if (nip10Data.root && !nip10Data.reply) {
        let rootEvent = await pool.get(currentReadRelays, { kinds: [1], ids: [nip10Data.root.id] });
        if (!rootEvent)
          return [];
        const authorMeta = await pool.get(currentReadRelays, { kinds: [0], authors: [rootEvent.pubkey] });
        if (authorMeta) {
          await injectAuthorsToNotes([rootEvent], [authorMeta]);
        }
        await injectDataToRootNotes([rootEvent], currentReadRelays, pool);
        return [rootEvent];
      }
      if (nip10Data.reply) {
        let parentEvent = await pool.get(currentReadRelays, { kinds: [1], ids: [nip10Data.reply.id] });
        if (!parentEvent)
          return [];
        const authorMeta = await pool.get(currentReadRelays, { kinds: [0], authors: [parentEvent.pubkey] });
        if (authorMeta) {
          await injectAuthorsToNotes([parentEvent], [authorMeta]);
        }
        const nip10DataParentReplyingTo = nip10_exports.parse(parentEvent);
        const parentReplyingToId = ((_a = nip10DataParentReplyingTo == null ? void 0 : nip10DataParentReplyingTo.reply) == null ? void 0 : _a.id) || ((_b = nip10DataParentReplyingTo == null ? void 0 : nip10DataParentReplyingTo.root) == null ? void 0 : _b.id);
        const parentReplyingToEvent = await pool.get(currentReadRelays, { kinds: [1], ids: [parentReplyingToId || ""] });
        if (parentReplyingToEvent) {
          const authorMeta2 = await pool.get(currentReadRelays, { kinds: [0], authors: [parentReplyingToEvent.pubkey] });
          if (authorMeta2) {
            await injectAuthorsToNotes([parentReplyingToEvent], [authorMeta2]);
          }
        }
        await injectDataToReplyNotes(parentReplyingToEvent, [parentEvent], currentReadRelays, pool);
        const ancestors = await getAncestorsEventsChain(parentEvent);
        return [parentEvent, ...ancestors];
      }
      return [];
    };
    const loadEventThread = async () => {
      var _a, _b;
      const { event, pool, currentReadRelays } = props;
      if (!(currentReadRelays == null ? void 0 : currentReadRelays.length) || !pool)
        return;
      if (isLoadingThread.value)
        return;
      isLoadingThread.value = true;
      const parentEvent = event.replyingTo.event;
      const authorMeta = await pool.get(currentReadRelays, { kinds: [0], authors: [parentEvent.pubkey] });
      if (authorMeta) {
        await injectAuthorsToNotes([parentEvent], [authorMeta]);
      }
      const nip10Data = nip10_exports.parse(parentEvent);
      if (!nip10Data.root && !nip10Data.reply) {
        await injectDataToRootNotes([parentEvent], currentReadRelays, pool);
      } else {
        const parentReplyingToId = ((_a = nip10Data == null ? void 0 : nip10Data.reply) == null ? void 0 : _a.id) || ((_b = nip10Data == null ? void 0 : nip10Data.root) == null ? void 0 : _b.id);
        const parentReplyingToEvent = await pool.get(currentReadRelays, { kinds: [1], ids: [parentReplyingToId || ""] });
        if (parentReplyingToEvent) {
          const authorMeta2 = await pool.get(currentReadRelays, { kinds: [0], authors: [parentReplyingToEvent.pubkey] });
          if (authorMeta2) {
            await injectAuthorsToNotes([parentReplyingToEvent], [authorMeta2]);
          }
        }
        await injectDataToReplyNotes(parentReplyingToEvent, [parentEvent], currentReadRelays, pool);
      }
      const parentAncestors = await getAncestorsEventsChain(parentEvent);
      const ancestors = [parentEvent, ...parentAncestors].reverse();
      isLoadingThread.value = false;
      ancestorsEvents.value = ancestors;
    };
    return (_ctx, _cache) => {
      const _component_EventContent = resolveComponent("EventContent", true);
      return openBlock(), createElementBlock(Fragment, null, [
        createBaseVNode("div", _hoisted_1$o, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(ancestorsEvents.value, (aEvent, i2) => {
            return openBlock(), createElementBlock("div", {
              class: "ancestor",
              key: _ctx.event.id
            }, [
              createVNode(_component_EventContent, {
                onToggleRawData: () => handleToggleRawData(aEvent.id),
                event: aEvent,
                currentReadRelays: _ctx.currentReadRelays,
                pool: _ctx.pool,
                hasReplyBtn: _ctx.hasReplyBtn,
                threadDescender: ancestorsEvents.value[i2 + 1] ? ancestorsEvents.value[i2 + 1] : _ctx.event
              }, null, 8, ["onToggleRawData", "event", "currentReadRelays", "pool", "hasReplyBtn", "threadDescender"])
            ]);
          }), 128)),
          isLoadingThread.value ? (openBlock(), createElementBlock("div", _hoisted_2$l, "Loading thread...")) : createCommentVNode("", true)
        ]),
        createBaseVNode("div", _hoisted_3$j, [
          createBaseVNode("div", {
            class: normalizeClass(["event-card__content", { "flipped": _ctx.event.showRawData }])
          }, [
            createBaseVNode("div", {
              class: normalizeClass(["event-card__front", "event__presentable-date", { "event-card__front_custom": _ctx.pubKey === _ctx.event.pubkey }])
            }, [
              unref(imagesStore).showImages && _ctx.event.author ? (openBlock(), createElementBlock("div", _hoisted_4$h, [
                createBaseVNode("img", {
                  class: "author-pic",
                  src: _ctx.event.author.picture,
                  alt: "user's avatar",
                  title: `Avatar for ${_ctx.event.author.name}`
                }, null, 8, _hoisted_5$e)
              ])) : createCommentVNode("", true),
              createBaseVNode("div", _hoisted_6$c, [
                createBaseVNode("div", _hoisted_7$9, [
                  createBaseVNode("div", null, [
                    createBaseVNode("a", {
                      class: "event-username-link",
                      onClick: _cache[0] || (_cache[0] = withModifiers(() => handleUserClick(_ctx.event.pubkey), ["prevent"])),
                      href: getUserPath(_ctx.event.pubkey)
                    }, [
                      createBaseVNode("b", _hoisted_9$8, toDisplayString(displayName(_ctx.event.author, _ctx.event.pubkey)), 1)
                    ], 8, _hoisted_8$8)
                  ]),
                  createBaseVNode("div", null, toDisplayString(unref(formatedDate)(_ctx.event.created_at)), 1)
                ]),
                _ctx.event.replyingTo ? (openBlock(), createElementBlock("div", _hoisted_10$8, [
                  _ctx.isMainEvent ? (openBlock(), createElementBlock("span", {
                    key: 0,
                    onClick: loadEventThread,
                    class: "view-thread event-username-link event-username-text"
                  }, [
                    createVNode(ThreadIcon),
                    createTextVNode(" View thread ")
                  ])) : createCommentVNode("", true),
                  _ctx.isMainEvent ? (openBlock(), createElementBlock("span", _hoisted_11$6, "  |  ")) : createCommentVNode("", true),
                  createBaseVNode("span", null, [
                    createTextVNode(" Replying to "),
                    createBaseVNode("a", {
                      onClick: _cache[1] || (_cache[1] = withModifiers(() => handleUserClick(_ctx.event.replyingTo.pubkey), ["prevent"])),
                      href: getUserPath(_ctx.event.replyingTo.pubkey),
                      class: "event-username-link event-username-text"
                    }, "@" + toDisplayString(displayName(_ctx.event.replyingTo.user, _ctx.event.replyingTo.pubkey)), 9, _hoisted_12$6)
                  ])
                ])) : createCommentVNode("", true),
                createBaseVNode("div", _hoisted_13$5, [
                  createVNode(EventText, { event: _ctx.event }, null, 8, ["event"])
                ]),
                createBaseVNode("div", _hoisted_14$5, [
                  createVNode(_sfc_main$w, {
                    onShowReplyField: handleToggleReplyField,
                    onHandleShowReplies: handleLoadReplies,
                    onHandleHideReplies: handleHideReplies,
                    hasReplyBtn: _ctx.hasReplyBtn,
                    likes: _ctx.event.likes,
                    reposts: _ctx.event.reposts,
                    replies: _ctx.event.replies
                  }, null, 8, ["hasReplyBtn", "likes", "reposts", "replies"]),
                  createBaseVNode("div", _hoisted_15$5, [
                    createBaseVNode("div", _hoisted_16$5, [
                      isCopiedEventLink.value ? (openBlock(), createBlock(CheckIcon, {
                        key: 0,
                        class: "event-footer-copy-icon event-footer-copy-icon_check"
                      })) : createCommentVNode("", true),
                      !isCopiedEventLink.value ? (openBlock(), createBlock(LinkIcon, {
                        key: 1,
                        onClick: handleCopyEventLink,
                        title: "Copy link",
                        class: "event-footer-copy-icon"
                      })) : createCommentVNode("", true)
                    ]),
                    createBaseVNode("span", {
                      onClick: _cache[2] || (_cache[2] = () => handleToggleRawData(_ctx.event.id)),
                      title: "See raw data",
                      class: "event-footer-code"
                    }, " {...} ")
                  ])
                ])
              ])
            ], 2),
            createBaseVNode("div", {
              class: normalizeClass(["event-card__back", { "event-card__back_custom": _ctx.pubKey === _ctx.event.pubkey, "event-details-first": _ctx.index === 0 }])
            }, [
              createBaseVNode("div", _hoisted_17$5, [
                createVNode(RawData, {
                  event: _ctx.event,
                  authorEvent: _ctx.event.authorEvent
                }, null, 8, ["event", "authorEvent"])
              ]),
              createBaseVNode("div", _hoisted_18$2, [
                createBaseVNode("div", {
                  class: normalizeClass(["event-footer__signature", { "event-footer__signature_invalid": !isSigVerified.value }])
                }, [
                  isSigVerified.value ? (openBlock(), createBlock(CheckSquareIcon, { key: 0 })) : createCommentVNode("", true),
                  !isSigVerified.value ? (openBlock(), createBlock(InvalidSignatureIcon, { key: 1 })) : createCommentVNode("", true),
                  createBaseVNode("span", _hoisted_19$2, toDisplayString(isSigVerified.value ? "Signature is valid" : "Invalid signature"), 1)
                ], 2),
                createBaseVNode("div", _hoisted_20$2, [
                  createBaseVNode("div", _hoisted_21$2, [
                    isCopiedEventLink.value ? (openBlock(), createBlock(CheckIcon, {
                      key: 0,
                      class: "event-footer-copy-icon event-footer-copy-icon_check"
                    })) : createCommentVNode("", true),
                    !isCopiedEventLink.value ? (openBlock(), createBlock(LinkIcon, {
                      key: 1,
                      onClick: handleCopyEventLink,
                      title: "Copy link",
                      class: "event-footer-copy-icon"
                    })) : createCommentVNode("", true)
                  ]),
                  createBaseVNode("span", {
                    onClick: _cache[3] || (_cache[3] = () => handleToggleRawData(_ctx.event.id)),
                    title: "See raw data",
                    class: "event-footer-code"
                  }, " {...} ")
                ])
              ])
            ], 2)
          ], 2)
        ]),
        showReplyField.value ? (openBlock(), createElementBlock("div", _hoisted_22$2, [
          withDirectives(createBaseVNode("textarea", {
            "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => replyText.value = $event),
            rows: "4",
            class: "reply-field__textarea",
            placeholder: "Write a reply..."
          }, null, 512), [
            [vModelText, replyText.value]
          ]),
          createBaseVNode("div", _hoisted_23$2, [
            createBaseVNode("div", _hoisted_24$2, toDisplayString(msgErr.value), 1),
            createBaseVNode("button", {
              disabled: isPublishingReply.value,
              onClick: handleSendReply,
              class: "reply-field__btn"
            }, toDisplayString(isPublishingReply.value ? "Sending reply..." : "Reply"), 9, _hoisted_25$2)
          ])
        ])) : createCommentVNode("", true),
        isLoadingReplies.value ? (openBlock(), createElementBlock("div", _hoisted_26$2, " Loading replies... ")) : createCommentVNode("", true),
        showReplies.value && eventReplies.value.length ? (openBlock(), createElementBlock("div", _hoisted_27$2, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(eventReplies.value, (reply, i2) => {
            return openBlock(), createElementBlock("div", {
              class: "reply",
              key: reply.id
            }, [
              createVNode(_component_EventContent, {
                onToggleRawData: _cache[5] || (_cache[5] = () => handleToggleRawData(_ctx.event.id)),
                event: reply,
                currentReadRelays: _ctx.currentReadRelays,
                pool: _ctx.pool,
                hasReplyBtn: _ctx.hasReplyBtn
              }, null, 8, ["event", "currentReadRelays", "pool", "hasReplyBtn"])
            ]);
          }), 128))
        ])) : createCommentVNode("", true)
      ], 64);
    };
  }
});
const EventContent_vue_vue_type_style_index_0_scoped_9a01161f_lang = "";
const EventContent = /* @__PURE__ */ _export_sfc(_sfc_main$p, [["__scopeId", "data-v-9a01161f"]]);
const _sfc_main$o = {};
const _hoisted_1$n = {
  xmlns: "http://www.w3.org/2000/svg",
  width: "16",
  height: "16",
  fill: "currentColor",
  class: "bi bi-arrows-expand",
  viewBox: "0 0 16 16"
};
const _hoisted_2$k = /* @__PURE__ */ createBaseVNode("path", {
  "fill-rule": "evenodd",
  d: "M1 8a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 0 1h-13A.5.5 0 0 1 1 8ZM7.646.146a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L8.5 1.707V5.5a.5.5 0 0 1-1 0V1.707L6.354 2.854a.5.5 0 1 1-.708-.708l2-2ZM8 10a.5.5 0 0 1 .5.5v3.793l1.146-1.147a.5.5 0 0 1 .708.708l-2 2a.5.5 0 0 1-.708 0l-2-2a.5.5 0 0 1 .708-.708L7.5 14.293V10.5A.5.5 0 0 1 8 10Z"
}, null, -1);
const _hoisted_3$i = [
  _hoisted_2$k
];
function _sfc_render$3(_ctx, _cache) {
  return openBlock(), createElementBlock("svg", _hoisted_1$n, _hoisted_3$i);
}
const ExpandArrow = /* @__PURE__ */ _export_sfc(_sfc_main$o, [["render", _sfc_render$3]]);
const usePool = defineStore("pool", () => {
  const pool = ref(new SimplePool());
  function resetPool() {
    pool.value = new SimplePool();
  }
  return { pool, resetPool };
});
const _withScopeId$d = (n) => (pushScopeId("data-v-4a71c53d"), n = n(), popScopeId(), n);
const _hoisted_1$m = { class: "event" };
const _hoisted_2$j = { key: 0 };
const _hoisted_3$h = {
  key: 1,
  class: "replies"
};
const _hoisted_4$g = { class: "replies__other-link" };
const _hoisted_5$d = /* @__PURE__ */ _withScopeId$d(() => /* @__PURE__ */ createBaseVNode("span", { class: "replies__other-text" }, " Show more replies ", -1));
const _hoisted_6$b = {
  key: 1,
  class: "replies__other"
};
const _hoisted_7$8 = {
  key: 2,
  class: "replies__other"
};
const _hoisted_8$7 = { class: "replies__other-text" };
const _hoisted_9$7 = { key: 4 };
const _hoisted_10$7 = {
  key: 5,
  class: "replies__list"
};
const _hoisted_11$5 = { class: "replies__list-item" };
const _hoisted_12$5 = /* @__PURE__ */ _withScopeId$d(() => /* @__PURE__ */ createBaseVNode("div", { class: "replies__list-item-line-horizontal" }, null, -1));
const _sfc_main$n = /* @__PURE__ */ defineComponent({
  __name: "ParentEventView",
  props: {
    event: {},
    pubKey: {},
    index: {},
    showReplies: { type: Boolean },
    hasReplyBtn: { type: Boolean },
    showRootReplies: { type: Boolean },
    currentReadRelays: {}
  },
  emits: ["toggleRawData"],
  setup(__props, { emit: __emit }) {
    const poolStore = usePool();
    const pool = poolStore.pool;
    const emit2 = __emit;
    const props = __props;
    const showReplyField = ref(false);
    const showMoreRepliesBtn = ref(false);
    const showAllReplies = ref(false);
    const isLoadingThread = ref(false);
    const isLoadingFirstReply = ref(false);
    const replyEvent = ref(null);
    const eventReplies = ref([]);
    onMounted(async () => {
      if (props.showReplies) {
        await loadRepliesPreiew();
      }
    });
    const loadRepliesPreiew = async () => {
      const { event, currentReadRelays } = props;
      if (!currentReadRelays.length)
        return;
      let replies = await pool.querySync(currentReadRelays, { kinds: [1], "#e": [event.id] });
      if (props.showRootReplies) {
        replies = replies.filter((reply2) => {
          var _a;
          const nip10Data = nip10_exports.parse(reply2);
          return !nip10Data.reply && ((_a = nip10Data == null ? void 0 : nip10Data.root) == null ? void 0 : _a.id) === event.id;
        });
      } else {
        replies = replies.filter((reply2) => {
          var _a, _b;
          const nip10Data = nip10_exports.parse(reply2);
          return ((_a = nip10Data == null ? void 0 : nip10Data.reply) == null ? void 0 : _a.id) === event.id || ((_b = nip10Data == null ? void 0 : nip10Data.root) == null ? void 0 : _b.id) === event.id;
        });
      }
      if (!replies.length)
        return;
      isLoadingFirstReply.value = true;
      showMoreRepliesBtn.value = replies.length > 1;
      let reply = replies[0];
      let tempReplies = [reply];
      await injectDataToReplyNotes(event, tempReplies, currentReadRelays, pool);
      reply = tempReplies[0];
      const authorMeta = await pool.get(currentReadRelays, { kinds: [0], limit: 1, authors: [reply.pubkey] });
      if (authorMeta) {
        reply.author = JSON.parse(authorMeta.content);
      }
      replyEvent.value = reply;
      isLoadingFirstReply.value = false;
    };
    const handleToggleRawData = (eventId, isMainEvent = false) => {
      if (isMainEvent) {
        return emit2("toggleRawData", eventId);
      }
    };
    const handleToggleReplyField = () => {
      showReplyField.value = !showReplyField.value;
    };
    const handleLoadMoreReplies = async () => {
      const { event, currentReadRelays } = props;
      if (!currentReadRelays.length)
        return;
      isLoadingThread.value = true;
      let replies = await pool.querySync(currentReadRelays, { kinds: [1], "#e": [event.id] });
      if (event.isRoot) {
        replies = filterRootEventReplies(event, replies);
      } else {
        replies = filterReplyEventReplies(event, replies);
      }
      if (!replies.length) {
        isLoadingThread.value = false;
        return;
      }
      const authors = replies.map((e) => e.pubkey);
      const uniqueAuthors = [...new Set(authors)];
      const authorsEvents = await pool.querySync(currentReadRelays, { kinds: [0], authors: uniqueAuthors });
      replies = injectAuthorsToNotes(replies, authorsEvents);
      await injectDataToReplyNotes(event, replies, currentReadRelays, pool);
      eventReplies.value = replies;
      showAllReplies.value = true;
      isLoadingThread.value = false;
    };
    const loadRootReplies = async () => {
      showReplyField.value = false;
      if (showAllReplies.value) {
        await handleLoadMoreReplies();
      } else {
        await loadRepliesPreiew();
      }
    };
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$m, [
        (openBlock(), createBlock(EventContent, {
          key: _ctx.event.id,
          onLoadRootReplies: loadRootReplies,
          onShowReplyField: handleToggleReplyField,
          onToggleRawData: _cache[0] || (_cache[0] = (eventId) => handleToggleRawData(eventId, true)),
          onLoadMoreReplies: handleLoadMoreReplies,
          event: _ctx.event,
          pubKey: _ctx.pubKey,
          isMainEvent: true,
          currentReadRelays: _ctx.currentReadRelays,
          pool: unref(pool),
          hasReplyBtn: _ctx.hasReplyBtn
        }, null, 8, ["event", "pubKey", "currentReadRelays", "pool", "hasReplyBtn"])),
        isLoadingFirstReply.value ? (openBlock(), createElementBlock("div", _hoisted_2$j, "Loading replies...")) : createCommentVNode("", true),
        _ctx.showReplies && replyEvent.value ? (openBlock(), createElementBlock("div", _hoisted_3$h, [
          !showAllReplies.value && showMoreRepliesBtn.value && !isLoadingThread.value ? (openBlock(), createElementBlock("div", {
            key: 0,
            onClick: handleLoadMoreReplies,
            class: "replies__other"
          }, [
            createBaseVNode("span", _hoisted_4$g, [
              _hoisted_5$d,
              createVNode(ExpandArrow)
            ])
          ])) : createCommentVNode("", true),
          isLoadingThread.value ? (openBlock(), createElementBlock("div", _hoisted_6$b, " Loading replies... ")) : createCommentVNode("", true),
          showAllReplies.value && showMoreRepliesBtn.value ? (openBlock(), createElementBlock("div", _hoisted_7$8, [
            createBaseVNode("span", _hoisted_8$7, " Loaded " + toDisplayString(eventReplies.value.length) + " replies ", 1)
          ])) : createCommentVNode("", true),
          createBaseVNode("div", {
            class: normalizeClass([
              "line-vertical",
              {
                "line-vertical_long": showMoreRepliesBtn.value,
                "line-vertical_reply-field": showReplyField.value && !showMoreRepliesBtn.value,
                "line-vertical_reply-field_long": showReplyField.value && showMoreRepliesBtn.value
              }
            ])
          }, null, 2),
          !showAllReplies.value ? (openBlock(), createElementBlock("div", {
            key: 3,
            class: normalizeClass(["line-horizontal", { "line-horizontal_height": showMoreRepliesBtn.value }])
          }, null, 2)) : createCommentVNode("", true),
          !showAllReplies.value ? (openBlock(), createElementBlock("div", _hoisted_9$7, [
            (openBlock(), createBlock(EventContent, {
              key: replyEvent.value.id,
              event: replyEvent.value,
              currentReadRelays: _ctx.currentReadRelays,
              pool: unref(pool),
              hasReplyBtn: _ctx.hasReplyBtn
            }, null, 8, ["event", "currentReadRelays", "pool", "hasReplyBtn"]))
          ])) : createCommentVNode("", true),
          showAllReplies.value ? (openBlock(), createElementBlock("div", _hoisted_10$7, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(eventReplies.value, (reply, i2) => {
              return openBlock(), createElementBlock("div", _hoisted_11$5, [
                _hoisted_12$5,
                createBaseVNode("div", {
                  class: normalizeClass(["replies__list-item-line-vertical", { "replies__list-item-line-vertical_short": i2 === eventReplies.value.length - 1 }])
                }, null, 2),
                (openBlock(), createBlock(EventContent, {
                  key: reply.id,
                  event: reply,
                  currentReadRelays: _ctx.currentReadRelays,
                  pool: unref(pool),
                  hasReplyBtn: _ctx.hasReplyBtn
                }, null, 8, ["event", "currentReadRelays", "pool", "hasReplyBtn"]))
              ]);
            }), 256))
          ])) : createCommentVNode("", true)
        ])) : createCommentVNode("", true)
      ]);
    };
  }
});
const ParentEventView_vue_vue_type_style_index_0_scoped_4a71c53d_lang = "";
const ParentEventView = /* @__PURE__ */ _export_sfc(_sfc_main$n, [["__scopeId", "data-v-4a71c53d"]]);
const _sfc_main$m = /* @__PURE__ */ defineComponent({
  __name: "RelayEventsList",
  props: {
    events: {},
    pubKey: {},
    currentReadRelays: {}
  },
  emits: ["toggleRawData"],
  setup(__props, { emit: __emit }) {
    const emit2 = __emit;
    const handleToggleRawData = (eventId) => {
      emit2("toggleRawData", eventId);
    };
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", null, [
        (openBlock(true), createElementBlock(Fragment, null, renderList(_ctx.events, (event, i2) => {
          return openBlock(), createBlock(ParentEventView, {
            key: event.id,
            class: "event",
            onToggleRawData: handleToggleRawData,
            currentReadRelays: _ctx.currentReadRelays,
            event,
            pubKey: _ctx.pubKey,
            index: i2,
            showRootReplies: true,
            showReplies: true,
            hasReplyBtn: true
          }, null, 8, ["currentReadRelays", "event", "pubKey", "index"]);
        }), 128))
      ]);
    };
  }
});
const RelayEventsList_vue_vue_type_style_index_0_scoped_68b94602_lang = "";
const RelayEventsList = /* @__PURE__ */ _export_sfc(_sfc_main$m, [["__scopeId", "data-v-68b94602"]]);
const _hoisted_1$l = {
  key: 0,
  class: "pagination"
};
const _hoisted_2$i = { key: 0 };
const _hoisted_3$g = { key: 1 };
const _hoisted_4$f = { key: 1 };
const _hoisted_5$c = { key: 4 };
const _sfc_main$l = /* @__PURE__ */ defineComponent({
  __name: "Pagination",
  props: {
    pagesCount: {},
    currentPage: {}
  },
  emits: ["showPage"],
  setup(__props, { emit: __emit }) {
    const emit2 = __emit;
    const route = useRoute();
    const paginate = (page) => {
      return {
        path: route.path,
        query: {
          ...route.query,
          page
        }
      };
    };
    watch(
      () => route.query.page,
      async (page) => {
        const p2 = parseInt(page);
        if (p2)
          emit2("showPage", p2);
      }
    );
    return (_ctx, _cache) => {
      const _component_router_link = resolveComponent("router-link");
      return _ctx.pagesCount > 1 ? (openBlock(), createElementBlock("div", _hoisted_1$l, [
        createTextVNode(" Pages: "),
        _ctx.pagesCount < 5 ? (openBlock(), createElementBlock("span", _hoisted_2$i, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(_ctx.pagesCount, (page) => {
            return openBlock(), createBlock(_component_router_link, {
              key: page,
              class: normalizeClass(["pagination__link", { "pagination__link_active": _ctx.currentPage == page }]),
              to: paginate(page)
            }, {
              default: withCtx(() => [
                createTextVNode(toDisplayString(page), 1)
              ]),
              _: 2
            }, 1032, ["class", "to"]);
          }), 128))
        ])) : createCommentVNode("", true),
        _ctx.pagesCount >= 5 ? (openBlock(), createElementBlock("span", _hoisted_3$g, [
          _ctx.currentPage >= 3 ? (openBlock(), createBlock(_component_router_link, {
            key: 1,
            class: normalizeClass(["pagination__link"]),
            to: paginate(1)
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(1))
            ]),
            _: 1
          }, 8, ["to"])) : createCommentVNode("", true),
          _ctx.currentPage > 3 ? (openBlock(), createElementBlock("span", _hoisted_4$f, "...")) : createCommentVNode("", true),
          _ctx.currentPage != 1 ? (openBlock(), createBlock(_component_router_link, {
            key: _ctx.currentPage - 1,
            class: normalizeClass(["pagination__link"]),
            to: paginate(_ctx.currentPage - 1)
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(_ctx.currentPage - 1), 1)
            ]),
            _: 1
          }, 8, ["to"])) : createCommentVNode("", true),
          (openBlock(), createBlock(_component_router_link, {
            key: _ctx.currentPage,
            class: normalizeClass(["pagination__link pagination__link_active"]),
            to: paginate(_ctx.currentPage)
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(_ctx.currentPage), 1)
            ]),
            _: 1
          }, 8, ["to"])),
          _ctx.currentPage != _ctx.pagesCount ? (openBlock(), createBlock(_component_router_link, {
            key: _ctx.currentPage + 1,
            class: normalizeClass(["pagination__link"]),
            to: paginate(_ctx.currentPage + 1)
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(_ctx.currentPage + 1), 1)
            ]),
            _: 1
          }, 8, ["to"])) : createCommentVNode("", true),
          _ctx.currentPage < _ctx.pagesCount - 2 ? (openBlock(), createElementBlock("span", _hoisted_5$c, "...")) : createCommentVNode("", true),
          _ctx.currentPage <= _ctx.pagesCount - 2 ? (openBlock(), createBlock(_component_router_link, {
            key: _ctx.pagesCount,
            class: normalizeClass(["pagination__link"]),
            to: paginate(_ctx.pagesCount)
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(_ctx.pagesCount), 1)
            ]),
            _: 1
          }, 8, ["to"])) : createCommentVNode("", true)
        ])) : createCommentVNode("", true)
      ])) : createCommentVNode("", true);
    };
  }
});
const Pagination_vue_vue_type_style_index_0_scoped_fa836b0e_lang = "";
const Pagination = /* @__PURE__ */ _export_sfc(_sfc_main$l, [["__scopeId", "data-v-fa836b0e"]]);
const _withScopeId$c = (n) => (pushScopeId("data-v-1382f7cb"), n = n(), popScopeId(), n);
const _hoisted_1$k = { class: "log" };
const _hoisted_2$h = /* @__PURE__ */ _withScopeId$c(() => /* @__PURE__ */ createBaseVNode("strong", null, "Relay events log", -1));
const _hoisted_3$f = { class: "log__list" };
const _hoisted_4$e = { class: "log__list-item" };
const _hoisted_5$b = { key: 0 };
const _hoisted_6$a = { key: 1 };
const _sfc_main$k = /* @__PURE__ */ defineComponent({
  __name: "RelayLog",
  props: {
    eventsLog: {}
  },
  setup(__props) {
    const props = __props;
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$k, [
        _hoisted_2$h,
        createBaseVNode("ul", _hoisted_3$f, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(props.eventsLog, (log) => {
            return openBlock(), createElementBlock("li", _hoisted_4$e, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(log, ({ type, value }) => {
                return openBlock(), createElementBlock(Fragment, null, [
                  type === "text" ? (openBlock(), createElementBlock("span", _hoisted_5$b, toDisplayString(value), 1)) : (openBlock(), createElementBlock("b", _hoisted_6$a, toDisplayString(value), 1))
                ], 64);
              }), 256))
            ]);
          }), 256))
        ])
      ]);
    };
  }
});
const RelayLog_vue_vue_type_style_index_0_scoped_1382f7cb_lang = "";
const RelayLog = /* @__PURE__ */ _export_sfc(_sfc_main$k, [["__scopeId", "data-v-1382f7cb"]]);
const useFeed = defineStore("feed", () => {
  const events = ref([]);
  const showNewEventsBadge = ref(false);
  const newEventsBadgeImageUrls = ref([]);
  const newEventsBadgeCount = ref(0);
  const newEventsToShow = ref([]);
  const paginationEventsIds = ref([]);
  const messageToBroadcast = ref("");
  const signedJson = ref("");
  const selectedFeedSource = ref("network");
  const isFollowsSource = computed(() => selectedFeedSource.value === "follows");
  const isNetworkSource = computed(() => selectedFeedSource.value === "network");
  const isLoadingFeedSource = ref(false);
  const isLoadingNewEvents = ref(false);
  const isLoadingMore = ref(false);
  function updateEvents(value) {
    events.value = value;
  }
  function pushToEvents(value) {
    events.value.push(value);
  }
  function toggleEventRawData(id) {
    const event = events.value.find((e) => e.id === id);
    if (event) {
      event.showRawData = !event.showRawData;
    }
  }
  function setShowNewEventsBadge(value) {
    showNewEventsBadge.value = value;
  }
  function setNewEventsBadgeImageUrls(value) {
    newEventsBadgeImageUrls.value = value;
  }
  function setNewEventsBadgeCount(value) {
    newEventsBadgeCount.value = value;
  }
  function updateNewEventsToShow(value) {
    newEventsToShow.value = value;
  }
  function pushToNewEventsToShow(value) {
    newEventsToShow.value.push(value);
  }
  function updatePaginationEventsIds(value) {
    paginationEventsIds.value = value;
  }
  function pushToPaginationEventsIds(value) {
    paginationEventsIds.value.push(value);
  }
  function updateMessageToBroadcast(value) {
    messageToBroadcast.value = value;
  }
  function updateSignedJson(value) {
    signedJson.value = value;
  }
  function setLoadingFeedSourceStatus(value) {
    isLoadingFeedSource.value = value;
  }
  function setLoadingMoreStatus(value) {
    isLoadingMore.value = value;
  }
  function setLoadingNewEventsStatus(value) {
    isLoadingNewEvents.value = value;
  }
  function setSelectedFeedSource(value) {
    selectedFeedSource.value = value === "follows" ? value : "network";
  }
  return {
    events,
    updateEvents,
    toggleEventRawData,
    showNewEventsBadge,
    setShowNewEventsBadge,
    newEventsBadgeImageUrls,
    setNewEventsBadgeImageUrls,
    newEventsBadgeCount,
    setNewEventsBadgeCount,
    newEventsToShow,
    updateNewEventsToShow,
    pushToNewEventsToShow,
    paginationEventsIds,
    updatePaginationEventsIds,
    pushToPaginationEventsIds,
    messageToBroadcast,
    updateMessageToBroadcast,
    signedJson,
    updateSignedJson,
    selectedFeedSource,
    setSelectedFeedSource,
    isFollowsSource,
    isNetworkSource,
    isLoadingFeedSource,
    setLoadingFeedSourceStatus,
    setLoadingNewEventsStatus,
    isLoadingNewEvents,
    pushToEvents,
    setLoadingMoreStatus,
    isLoadingMore
  };
});
const _withScopeId$b = (n) => (pushScopeId("data-v-e563eef7"), n = n(), popScopeId(), n);
const _hoisted_1$j = { class: "laod-from" };
const _hoisted_2$g = /* @__PURE__ */ _withScopeId$b(() => /* @__PURE__ */ createBaseVNode("div", { class: "laod-from__title" }, " Load posts from ", -1));
const _hoisted_3$e = { class: "load-from__select-wrapper" };
const _hoisted_4$d = /* @__PURE__ */ _withScopeId$b(() => /* @__PURE__ */ createBaseVNode("option", { value: "network" }, "network", -1));
const _hoisted_5$a = /* @__PURE__ */ _withScopeId$b(() => /* @__PURE__ */ createBaseVNode("option", { value: "follows" }, "follows", -1));
const _hoisted_6$9 = [
  _hoisted_4$d,
  _hoisted_5$a
];
const _hoisted_7$7 = {
  key: 0,
  class: "notice"
};
const _sfc_main$j = /* @__PURE__ */ defineComponent({
  __name: "LoadFromFeedSelect",
  setup(__props) {
    const nsecStore = useNsec();
    const feedStore = useFeed();
    const showNotice = computed(() => {
      return feedStore.selectedFeedSource === "follows" && !nsecStore.isNsecValidTemp;
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock(Fragment, null, [
        createBaseVNode("div", _hoisted_1$j, [
          _hoisted_2$g,
          createBaseVNode("div", _hoisted_3$e, [
            withDirectives(createBaseVNode("select", {
              "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => unref(feedStore).selectedFeedSource = $event),
              class: "load-from__select",
              name: "feed-source",
              id: "feed-source-select"
            }, _hoisted_6$9, 512), [
              [vModelSelect, unref(feedStore).selectedFeedSource]
            ])
          ])
        ]),
        showNotice.value ? (openBlock(), createElementBlock("div", _hoisted_7$7, " Please log in to load posts from people you follow. ")) : createCommentVNode("", true)
      ], 64);
    };
  }
});
const LoadFromFeedSelect_vue_vue_type_style_index_0_scoped_e563eef7_lang = "";
const LoadFromFeedSelect = /* @__PURE__ */ _export_sfc(_sfc_main$j, [["__scopeId", "data-v-e563eef7"]]);
const DEFAULT_RELAYS = [
  "wss://nos.lol",
  "wss://relay.nostr.band",
  "wss://relay.nostr.ai",
  "wss://relayable.org",
  "wss://relay.damus.io"
];
const fallbackRelays = [
  "wss://relay.damus.io",
  "wss://nostr-pub.wellorder.net",
  "wss://offchain.pub",
  "wss://nostr.fmt.wiz.biz",
  "wss://eden.nostr.land",
  "wss://atlas.nostr.land",
  "wss://relay.snort.social",
  "wss://nostr.fly.dev",
  "wss://nostr.nostr.band",
  "wss://relay.nostrgraph.net",
  "wss://relay.nostr.bg",
  "wss://nostr.wine",
  "wss://nos.lol",
  "wss://relay.mostr.pub",
  "wss://no.str.cr",
  "wss://brb.io",
  "wss://nostr.zebedee.cloud"
];
const DEFAULT_EVENTS_COUNT = 20;
const _withScopeId$a = (n) => (pushScopeId("data-v-1dfc7855"), n = n(), popScopeId(), n);
const _hoisted_1$i = { id: "feed" };
const _hoisted_2$f = { class: "columns" };
const _hoisted_3$d = {
  key: 0,
  class: "connecting-notice"
};
const _hoisted_4$c = {
  key: 1,
  class: "connecting-notice"
};
const _hoisted_5$9 = {
  key: 0,
  class: "new-events__imgs"
};
const _hoisted_6$8 = ["src"];
const _hoisted_7$6 = ["src"];
const _hoisted_8$6 = { class: "new-events__text" };
const _hoisted_9$6 = /* @__PURE__ */ _withScopeId$a(() => /* @__PURE__ */ createBaseVNode("b", { class: "new-events__arrow" }, "↑", -1));
const _hoisted_10$6 = {
  key: 3,
  class: "loading-more"
};
const _sfc_main$i = /* @__PURE__ */ defineComponent({
  __name: "Feed",
  props: {
    eventsLog: {}
  },
  emits: ["loadNewRelayEvents", "handleRelayConnect"],
  setup(__props, { emit: __emit }) {
    const relayStore = useRelay();
    const imagesStore = useImages();
    const feedStore = useFeed();
    const nsecStore = useNsec();
    const poolStore = usePool();
    const pool = poolStore.pool;
    const emit2 = __emit;
    const newAuthorImg1 = computed(() => feedStore.newEventsBadgeImageUrls[0]);
    const newAuthorImg2 = computed(() => feedStore.newEventsBadgeImageUrls[1]);
    const currentPage = ref(1);
    const pagesCount = computed(() => Math.ceil(feedStore.paginationEventsIds.length / DEFAULT_EVENTS_COUNT));
    const route = useRoute();
    const currPath = computed(() => route.path);
    watch(
      () => route.path,
      async () => {
        if (currentPage.value > 1) {
          showFeedPage(1);
        }
      }
    );
    watch(
      () => feedStore.selectedFeedSource,
      async (source) => {
        if (relayStore.currentRelay.connected && nsecStore.isValidNsecPresented()) {
          await emit2("handleRelayConnect", true, true);
        }
      }
    );
    onMounted(() => {
      if (pagesCount.value > 1) {
        showFeedPage(1);
      }
    });
    const showFeedPage = async (page) => {
      if (feedStore.isLoadingNewEvents)
        return;
      feedStore.setLoadingNewEventsStatus(true);
      const relays = relayStore.connectedFeedRelaysUrls;
      if (!relays.length)
        return;
      const limit = DEFAULT_EVENTS_COUNT;
      const start = (page - 1) * limit;
      const end = start + limit;
      const reversedIds = feedStore.paginationEventsIds.slice().reverse();
      const idsToShow = reversedIds.slice(start, end);
      const postsEvents = await pool.querySync(relays, { ids: idsToShow });
      const authors = Array.from(/* @__PURE__ */ new Set([...postsEvents.map((e) => e.pubkey)]));
      const authorsAndData = await Promise.all([
        Promise.all(
          authors.map(async (author) => {
            return pool.get(relays, { kinds: [0], authors: [author] });
          })
        ),
        injectDataToRootNotes(postsEvents, relays, pool)
      ]);
      const authorsEvents = authorsAndData[0];
      let posts = injectAuthorsToNotes(postsEvents, authorsEvents);
      posts = posts.sort((a, b) => b.created_at - a.created_at);
      feedStore.updateEvents(posts);
      feedStore.setLoadingNewEventsStatus(false);
      currentPage.value = page;
    };
    const loadNewRelayEvents = async () => {
      await emit2("loadNewRelayEvents");
      currentPage.value = 1;
    };
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$i, [
        createVNode(LoadFromFeedSelect),
        createBaseVNode("div", _hoisted_2$f, [
          createBaseVNode("div", {
            class: normalizeClass(["events", { "events_hidden": currPath.value === "/log" }])
          }, [
            unref(feedStore).isLoadingFeedSource ? (openBlock(), createElementBlock("div", _hoisted_3$d, " Loading feed from " + toDisplayString(unref(feedStore).selectedFeedSource) + "... ", 1)) : createCommentVNode("", true),
            unref(feedStore).isLoadingNewEvents ? (openBlock(), createElementBlock("div", _hoisted_4$c, " Loading new notes... ")) : createCommentVNode("", true),
            unref(feedStore).showNewEventsBadge ? (openBlock(), createElementBlock("div", {
              key: 2,
              onClick: loadNewRelayEvents,
              class: normalizeClass(["new-events", { "new-events_top-shifted": unref(feedStore).isLoadingNewEvents }])
            }, [
              unref(imagesStore).showImages ? (openBlock(), createElementBlock("div", _hoisted_5$9, [
                createBaseVNode("img", {
                  class: "new-events__img",
                  src: newAuthorImg1.value,
                  alt: "user's avatar"
                }, null, 8, _hoisted_6$8),
                createBaseVNode("img", {
                  class: "new-events__img",
                  src: newAuthorImg2.value,
                  alt: "user's avatar"
                }, null, 8, _hoisted_7$6)
              ])) : createCommentVNode("", true),
              createBaseVNode("span", _hoisted_8$6, toDisplayString(unref(feedStore).newEventsBadgeCount) + " new notes", 1),
              _hoisted_9$6
            ], 2)) : createCommentVNode("", true),
            createVNode(RelayEventsList, {
              events: unref(feedStore).events,
              pubKey: unref(nsecStore).getPubkey(),
              showImages: unref(imagesStore).showImages,
              currentReadRelays: unref(relayStore).connectedFeedRelaysUrls,
              onToggleRawData: unref(feedStore).toggleEventRawData
            }, null, 8, ["events", "pubKey", "showImages", "currentReadRelays", "onToggleRawData"]),
            unref(feedStore).isLoadingMore ? (openBlock(), createElementBlock("div", _hoisted_10$6, " Loading more posts... ")) : createCommentVNode("", true),
            createVNode(Pagination, {
              pagesCount: pagesCount.value,
              currentPage: currentPage.value,
              onShowPage: showFeedPage
            }, null, 8, ["pagesCount", "currentPage"])
          ], 2),
          createBaseVNode("div", {
            class: normalizeClass(["log-wrapper", { "log-wrapper_hidden": currPath.value !== "/log" }])
          }, [
            createVNode(RelayLog, { eventsLog: _ctx.eventsLog }, null, 8, ["eventsLog"])
          ], 2)
        ])
      ]);
    };
  }
});
const Feed_vue_vue_type_style_index_0_scoped_1dfc7855_lang = "";
const Feed = /* @__PURE__ */ _export_sfc(_sfc_main$i, [["__scopeId", "data-v-1dfc7855"]]);
const _withScopeId$9 = (n) => (pushScopeId("data-v-7bdb886c"), n = n(), popScopeId(), n);
const _hoisted_1$h = { class: "message-fields-wrapper" };
const _hoisted_2$e = { class: "message-fields" };
const _hoisted_3$c = { class: "message-fields__field" };
const _hoisted_4$b = /* @__PURE__ */ _withScopeId$9(() => /* @__PURE__ */ createBaseVNode("label", { for: "message" }, [
  /* @__PURE__ */ createBaseVNode("strong", null, "Message to broadcast")
], -1));
const _hoisted_5$8 = { class: "field-elements" };
const _hoisted_6$7 = ["value"];
const _hoisted_7$5 = { class: "send-btn-wrapper" };
const _hoisted_8$5 = ["disabled"];
const _hoisted_9$5 = { class: "error" };
const _hoisted_10$5 = { class: "notice" };
const _sfc_main$h = /* @__PURE__ */ defineComponent({
  __name: "MessageInput",
  props: {
    sentEventIds: {},
    isSendingMessage: { type: Boolean },
    broadcastNotice: {}
  },
  emits: ["broadcastEvent"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit2 = __emit;
    const nsecStore = useNsec();
    const feedStore = useFeed();
    const msgErr = ref("");
    const handleSendMessage = async () => {
      const nsecValue = nsecStore.nsec ? nsecStore.nsec.trim() : "";
      if (!nsecValue.length) {
        msgErr.value = "Please provide your private key or generate random key.";
        return;
      }
      const messageValue = feedStore.messageToBroadcast.trim();
      if (!messageValue.length) {
        msgErr.value = "Please provide message to broadcast.";
        return;
      }
      let privkey;
      let pubkey;
      try {
        privkey = nsecStore.getPrivkeyBytes();
        if (!privkey) {
          throw new Error();
        }
        pubkey = nsecStore.getPubkey();
        if (!pubkey.length) {
          throw new Error();
        }
      } catch (e) {
        msgErr.value = `Invalid private key. Please check it and try again.`;
        return;
      }
      const event = {
        kind: 1,
        pubkey,
        created_at: Math.floor(Date.now() / 1e3),
        content: messageValue,
        tags: [],
        id: "",
        sig: ""
      };
      const signedEvent = finalizeEvent(event, privkey);
      if (props.sentEventIds.has(signedEvent.id)) {
        msgErr.value = "The same event can't be sent twice (same id, signature).";
        return;
      }
      msgErr.value = "";
      emit2("broadcastEvent", signedEvent, "text");
    };
    const handleInput = (event) => {
      var _a;
      feedStore.updateMessageToBroadcast((_a = event == null ? void 0 : event.target) == null ? void 0 : _a.value);
    };
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$h, [
        createBaseVNode("div", _hoisted_2$e, [
          createBaseVNode("div", _hoisted_3$c, [
            _hoisted_4$b,
            createBaseVNode("div", _hoisted_5$8, [
              createBaseVNode("textarea", {
                class: "message-input",
                name: "message",
                id: "message",
                cols: "30",
                rows: "3",
                value: unref(feedStore).messageToBroadcast,
                onInput: handleInput,
                placeholder: "Test message 👋"
              }, null, 40, _hoisted_6$7)
            ]),
            createBaseVNode("div", _hoisted_7$5, [
              createBaseVNode("button", {
                disabled: _ctx.isSendingMessage,
                class: "send-btn",
                onClick: handleSendMessage
              }, toDisplayString(_ctx.isSendingMessage ? "Broadcasting..." : "Broadcast"), 9, _hoisted_8$5)
            ])
          ])
        ]),
        createBaseVNode("div", _hoisted_9$5, toDisplayString(msgErr.value), 1),
        createBaseVNode("div", _hoisted_10$5, toDisplayString(_ctx.broadcastNotice), 1)
      ]);
    };
  }
});
const MessageInput_vue_vue_type_style_index_0_scoped_7bdb886c_lang = "";
const MessageInput = /* @__PURE__ */ _export_sfc(_sfc_main$h, [["__scopeId", "data-v-7bdb886c"]]);
const _withScopeId$8 = (n) => (pushScopeId("data-v-efc02ad6"), n = n(), popScopeId(), n);
const _hoisted_1$g = { class: "message-fields-wrapper" };
const _hoisted_2$d = { class: "signed-message-desc" };
const _hoisted_3$b = /* @__PURE__ */ _withScopeId$8(() => /* @__PURE__ */ createBaseVNode("p", { class: "signed-message-desc_p" }, [
  /* @__PURE__ */ createTextVNode(" Event should be signed with your private key in advance. Event will be broadcasted to a selected relay. More details about events and signatures are "),
  /* @__PURE__ */ createBaseVNode("a", {
    target: "_blank",
    href: "https://github.com/nostr-protocol/nips/blob/master/01.md#events-and-signatures"
  }, "here"),
  /* @__PURE__ */ createTextVNode(". ")
], -1));
const _hoisted_4$a = { class: "signed-message-desc_p" };
const _hoisted_5$7 = /* @__PURE__ */ _withScopeId$8(() => /* @__PURE__ */ createBaseVNode("br", null, null, -1));
const _hoisted_6$6 = {
  key: 0,
  class: "additional-relays"
};
const _hoisted_7$4 = { class: "additional-relay-field" };
const _hoisted_8$4 = /* @__PURE__ */ _withScopeId$8(() => /* @__PURE__ */ createBaseVNode("span", null, "1.", -1));
const _hoisted_9$4 = ["value"];
const _hoisted_10$4 = { class: "additional-relay-field" };
const _hoisted_11$4 = ["onInput"];
const _hoisted_12$4 = { class: "message-fields__field_sig" };
const _hoisted_13$4 = /* @__PURE__ */ _withScopeId$8(() => /* @__PURE__ */ createBaseVNode("label", {
  class: "message-fields__label",
  for: "signed_json"
}, [
  /* @__PURE__ */ createBaseVNode("strong", null, "JSON of a signed event")
], -1));
const _hoisted_14$4 = { class: "field-elements" };
const _hoisted_15$4 = { class: "signed-json-btn-wrapper" };
const _hoisted_16$4 = { class: "error" };
const _hoisted_17$4 = ["disabled"];
const _sfc_main$g = /* @__PURE__ */ defineComponent({
  __name: "SignedEventInput",
  props: {
    isSendingMessage: { type: Boolean },
    broadcastError: {}
  },
  emits: ["broadcastEvent"],
  setup(__props, { emit: __emit }) {
    const emit2 = __emit;
    const relayStore = useRelay();
    const feedStore = useFeed();
    const jsonErr = ref("");
    const handleSendSignedEvent = () => {
      if (!feedStore.signedJson.length) {
        jsonErr.value = "Provide signed event.";
        return;
      }
      let event;
      try {
        event = JSON.parse(feedStore.signedJson);
      } catch (e) {
        jsonErr.value = "Invalid JSON. Please check it and try again.";
        return;
      }
      const relay = relayStore.currentRelay;
      if (!(relay == null ? void 0 : relay.connected)) {
        jsonErr.value = "Please connect to relay first.";
        return;
      }
      jsonErr.value = "";
      emit2("broadcastEvent", event, "json");
    };
    const handleClickAddNewField = () => {
      const newCount = relayStore.additionalRelaysCountForSignedEvent + 1;
      relayStore.updateAdditionalRelaysCountForSignedEvent(newCount);
    };
    const handleJsonInput = (event) => {
      var _a;
      feedStore.updateSignedJson((_a = event == null ? void 0 : event.target) == null ? void 0 : _a.value);
    };
    const handleRelayInput = (event, index) => {
      var _a;
      const value = (_a = event == null ? void 0 : event.target) == null ? void 0 : _a.value;
      relayStore.updateRelayAdditionalRelaysUrlsForSignedEvent(index, value);
    };
    return (_ctx, _cache) => {
      var _a, _b;
      return openBlock(), createElementBlock("div", _hoisted_1$g, [
        createBaseVNode("div", _hoisted_2$d, [
          _hoisted_3$b,
          createBaseVNode("p", _hoisted_4$a, [
            createTextVNode(" Event will be broadcasted to a selected relay. You can add more relays to retransmit the event. "),
            _hoisted_5$7,
            createBaseVNode("button", {
              class: "additional-relay-btn",
              onClick: handleClickAddNewField
            }, " Add relay "),
            unref(relayStore).additionalRelaysCountForSignedEvent > 0 ? (openBlock(), createElementBlock("div", _hoisted_6$6, [
              createBaseVNode("div", _hoisted_7$4, [
                _hoisted_8$4,
                createBaseVNode("input", {
                  readonly: "",
                  value: ((_a = unref(relayStore).currentRelay) == null ? void 0 : _a.url) ? `${(_b = unref(relayStore).currentRelay) == null ? void 0 : _b.url} (already selected)` : "Firstly connect to default relay",
                  type: "text"
                }, null, 8, _hoisted_9$4)
              ]),
              (openBlock(true), createElementBlock(Fragment, null, renderList(unref(relayStore).additionalRelaysCountForSignedEvent, (i2) => {
                return openBlock(), createElementBlock("div", null, [
                  createBaseVNode("div", _hoisted_10$4, [
                    createBaseVNode("span", null, toDisplayString(i2 + 1) + ".", 1),
                    createBaseVNode("input", {
                      onInput: (event) => handleRelayInput(event, i2),
                      placeholder: "[wss://]relay.example.com",
                      type: "text"
                    }, null, 40, _hoisted_11$4)
                  ])
                ]);
              }), 256))
            ])) : createCommentVNode("", true)
          ])
        ]),
        createBaseVNode("div", _hoisted_12$4, [
          _hoisted_13$4,
          createBaseVNode("div", _hoisted_14$4, [
            createBaseVNode("textarea", {
              class: "signed-json-textarea",
              name: "signed_json",
              id: "signed_json",
              cols: "30",
              rows: "5",
              onInput: handleJsonInput,
              placeholder: '{"kind":1,"pubkey":"5486dbb083512982669fa180aa02d722ce35054233cea724061fbc5f39f81aa3","created_at":1685664152,"content":"Test message 👋","tags":[],"id":"89adae408121ba6d721203365becff4d312292a9dd9b7a35ffa230a1483b09a2","sig":"b2592ae88ba1040c928e458dd6822413f148c8cc4f478d992e024e8c9d9648b96e6ce6dc564ab5815675007f824d9e9f634f8dbde554afeb6e594bcaac4389dd"}'
            }, toDisplayString(unref(feedStore).signedJson), 33)
          ])
        ]),
        createBaseVNode("div", _hoisted_15$4, [
          createBaseVNode("div", _hoisted_16$4, toDisplayString(jsonErr.value) + " " + toDisplayString(_ctx.broadcastError), 1),
          createBaseVNode("button", {
            disabled: _ctx.isSendingMessage,
            class: "send-btn send-btn_signed-json",
            onClick: handleSendSignedEvent
          }, toDisplayString(_ctx.isSendingMessage ? "Broadcasting..." : "Broadcast"), 9, _hoisted_17$4)
        ])
      ]);
    };
  }
});
const SignedEventInput_vue_vue_type_style_index_0_scoped_efc02ad6_lang = "";
const SignedEventInput = /* @__PURE__ */ _export_sfc(_sfc_main$g, [["__scopeId", "data-v-efc02ad6"]]);
const _hoisted_1$f = /* @__PURE__ */ createStaticVNode('<h3>Slightly Private App</h3><p><a href="https://nostr.com">nostr</a> is public, censorship-resistant social network. It&#39;s simple: <ol><li>Select a relay from the list, or specify a <a href="https://nostr.watch/" target="_blank">custom URL</a></li><li><em>Optionally</em>, set your private key, to create new messages</li></ol></p><p> Traditional social networks can suppress certain posts or users. In nostr, every message is signed by user&#39;s <em>private key</em> and broadcasted to <em>relays</em>. <strong>Messages are tamper-resistant</strong>: no one can edit them, or the signature will become invalid. <strong>Users can&#39;t be blocked</strong>: even if a relay blocks someone, it&#39;s always possible to switch to a different one, or create up a personal relay. </p><p> The app is available at <a href="http://nostr.spa">nostr.spa</a>. You can: <ul><li><em>Connect</em> and see relay&#39;s global feed.</li><li><em>Post</em> new messages to the relay.</li><li><em>Broadcast</em> a pre-signed message. No need to enter a private key.</li><li><em>Search</em> information about a user or an event.</li></ul></p>', 4);
const _hoisted_5$6 = /* @__PURE__ */ createStaticVNode("<ul><li>No tracking from our end</li><li>Private keys are not sent anywhere. They are stored in RAM of your device</li><li>Relay will see your ip+browser after you click <em>Connect</em> button</li><li>GitHub will see ip+browser of anyone who&#39;s using the app, because it&#39;s hosted on GitHub Pages. They won&#39;t see any nostr-specific interactions you will make</li><li><em>Show avatars</em> feature will leak your ip+browser to random people on the internet. Since there are no centralized servers in nostr, every user can specify their own URL for avatar hosting. Meaning, users can control the hosting webservers and see logs</li><li><em>Remember me</em> feature will write private key you&#39;ve entered to browser&#39;s Local Storage, which is usually stored on your device&#39;s disk</li><li>VPN or TOR usage is advised, <em>as with any nostr client</em>, to prevent ip leakage</li></ul>", 1);
const _hoisted_6$5 = /* @__PURE__ */ createStaticVNode('<h3>Open source</h3><p> The lightweight nostr client is built to showcase <a href="/noble/">noble</a> cryptography. Signing is done using <a target="_blank" href="https://github.com/paulmillr/noble-curves">noble-curves</a>, while <a target="_blank" href="https://github.com/paulmillr/scure-base">scure-base</a> is used for bech32, <a target="_blank" href="https://github.com/nbd-wtf/nostr-tools">nostr-tools</a> are used for general nostr utilities and Vue.js is utilized for UI. Check out <a target="_blank" href="https://github.com/paulmillr/paulmillr.github.io">the source code</a>. You are welcome to host the client on your personal website. </p>', 2);
const _sfc_main$f = /* @__PURE__ */ defineComponent({
  __name: "Help",
  props: {
    showPrivacy: {}
  },
  setup(__props) {
    const route = useRoute();
    const privacyEl = ref(null);
    onMounted(() => {
      if (privacyEl.value && route.hash == "#privacy") {
        privacyEl.value.scrollIntoView();
      }
    });
    onBeforeUpdate(() => {
      if (privacyEl.value && route.hash == "#privacy") {
        privacyEl.value.scrollIntoView();
      }
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock(Fragment, null, [
        _hoisted_1$f,
        createBaseVNode("p", null, [
          createBaseVNode("h3", {
            id: "#privacy",
            ref_key: "privacyEl",
            ref: privacyEl
          }, "Privacy policy", 512),
          _hoisted_5$6
        ]),
        _hoisted_6$5
      ], 64);
    };
  }
});
const gettingUserInfoId = reactive({
  value: 1,
  update(value) {
    this.value = value;
  }
});
const useUserNotes = defineStore("user-notes", () => {
  const notes = ref([]);
  const allNotesIds = ref([]);
  function updateNotes(events) {
    notes.value = events;
  }
  function updateIds(value) {
    allNotesIds.value = value;
  }
  function toggleRawData(id) {
    const event = notes.value.find((e) => e.id === id);
    if (event) {
      event.showRawData = !event.showRawData;
    }
  }
  return { notes, allNotesIds, updateNotes, updateIds, toggleRawData };
});
const _withScopeId$7 = (n) => (pushScopeId("data-v-59817eec"), n = n(), popScopeId(), n);
const _hoisted_1$e = { class: "event" };
const _hoisted_2$c = {
  key: 0,
  class: "event__content"
};
const _hoisted_3$a = /* @__PURE__ */ _withScopeId$7(() => /* @__PURE__ */ createBaseVNode("hr", null, null, -1));
const _hoisted_4$9 = { class: "event__code-block" };
const _hoisted_5$5 = { class: "event__code-title" };
const _hoisted_6$4 = /* @__PURE__ */ _withScopeId$7(() => /* @__PURE__ */ createBaseVNode("b", null, "Author: ", -1));
const _hoisted_7$3 = { class: "content-col_code" };
const _hoisted_8$3 = { class: "event__code" };
const _hoisted_9$3 = { class: "event__code-block" };
const _hoisted_10$3 = { class: "event__code-title" };
const _hoisted_11$3 = /* @__PURE__ */ _withScopeId$7(() => /* @__PURE__ */ createBaseVNode("b", null, "Event id: ", -1));
const _hoisted_12$3 = { class: "content-col_code" };
const _hoisted_13$3 = { class: "event__code" };
const _hoisted_14$3 = /* @__PURE__ */ _withScopeId$7(() => /* @__PURE__ */ createBaseVNode("div", { class: "header-col" }, [
  /* @__PURE__ */ createBaseVNode("b", null, "Created: ")
], -1));
const _hoisted_15$3 = { class: "content-col_code" };
const _hoisted_16$3 = { class: "event__code" };
const _hoisted_17$3 = { class: "event-footer__signature-text" };
const _sfc_main$e = /* @__PURE__ */ defineComponent({
  __name: "UserEvent",
  props: {
    event: {},
    author: {},
    key: {}
  },
  setup(__props) {
    const props = __props;
    const showRawData = ref(false);
    const showHexId = ref(false);
    const showHexPubkey = ref(false);
    const id = ref("");
    const sig = ref("");
    const pubkey = ref("");
    const created_at = ref(0);
    const isSigVerified = ref(false);
    watchEffect(() => {
      const { event } = props;
      id.value = event.id;
      sig.value = event.sig;
      pubkey.value = event.pubkey;
      created_at.value = event.created_at;
    });
    onMounted(() => {
      if (Object.keys(props.event).length === 0) {
        return;
      }
      isSigVerified.value = verifyEvent(props.event);
    });
    const handleToggleRawData = () => {
      showRawData.value = !showRawData.value;
    };
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$e, [
        !showRawData.value ? (openBlock(), createElementBlock("div", _hoisted_2$c, [
          renderSlot(_ctx.$slots, "default", {}, () => [
            createTextVNode("No content for event")
          ], true),
          _hoisted_3$a,
          createBaseVNode("div", _hoisted_4$9, [
            createBaseVNode("div", _hoisted_5$5, [
              _hoisted_6$4,
              createBaseVNode("button", {
                class: "event__code-btn",
                onClick: _cache[0] || (_cache[0] = ($event) => showHexPubkey.value = !showHexPubkey.value)
              }, toDisplayString(showHexPubkey.value ? "npub" : "hex"), 1)
            ]),
            createBaseVNode("div", _hoisted_7$3, [
              createBaseVNode("code", _hoisted_8$3, toDisplayString(showHexPubkey.value ? pubkey.value : unref(nip19_exports).npubEncode(pubkey.value)), 1)
            ])
          ]),
          createBaseVNode("div", _hoisted_9$3, [
            createBaseVNode("div", _hoisted_10$3, [
              _hoisted_11$3,
              createBaseVNode("button", {
                class: "event__code-btn",
                onClick: _cache[1] || (_cache[1] = ($event) => showHexId.value = !showHexId.value)
              }, toDisplayString(showHexId.value ? "nevent" : "hex"), 1)
            ]),
            createBaseVNode("div", _hoisted_12$3, [
              createBaseVNode("code", _hoisted_13$3, toDisplayString(showHexId.value ? id.value : unref(nip19_exports).neventEncode({ id: id.value })), 1)
            ])
          ]),
          createBaseVNode("div", null, [
            _hoisted_14$3,
            createBaseVNode("div", _hoisted_15$3, [
              createBaseVNode("code", _hoisted_16$3, toDisplayString(unref(formatedDate)(created_at.value)), 1)
            ])
          ])
        ])) : createCommentVNode("", true),
        showRawData.value ? (openBlock(), createBlock(RawData, {
          key: 1,
          isUserEvent: true,
          event: _ctx.event,
          authorEvent: _ctx.event
        }, null, 8, ["event", "authorEvent"])) : createCommentVNode("", true),
        createBaseVNode("div", {
          class: normalizeClass(["event-footer", { "event-footer_flex-end": !showRawData.value }])
        }, [
          showRawData.value ? (openBlock(), createElementBlock("div", {
            key: 0,
            class: normalizeClass(["event-footer__signature", { "event-footer__signature_invalid": !isSigVerified.value }])
          }, [
            isSigVerified.value ? (openBlock(), createBlock(CheckSquareIcon, { key: 0 })) : createCommentVNode("", true),
            !isSigVerified.value ? (openBlock(), createBlock(InvalidSignatureIcon, { key: 1 })) : createCommentVNode("", true),
            createBaseVNode("span", _hoisted_17$3, toDisplayString(isSigVerified.value ? "Signature is valid" : "Invalid signature"), 1)
          ], 2)) : createCommentVNode("", true),
          createBaseVNode("div", null, [
            createBaseVNode("span", {
              class: "event-footer-code",
              onClick: handleToggleRawData
            }, "{...}")
          ])
        ], 2)
      ]);
    };
  }
});
const UserEvent_vue_vue_type_style_index_0_scoped_59817eec_lang = "";
const UserEvent = /* @__PURE__ */ _export_sfc(_sfc_main$e, [["__scopeId", "data-v-59817eec"]]);
const _sfc_main$d = {};
const _hoisted_1$d = {
  xmlns: "http://www.w3.org/2000/svg",
  width: "16",
  height: "16",
  fill: "currentColor",
  class: "bi bi-download",
  viewBox: "0 0 16 16"
};
const _hoisted_2$b = /* @__PURE__ */ createBaseVNode("path", { d: "M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" }, null, -1);
const _hoisted_3$9 = /* @__PURE__ */ createBaseVNode("path", { d: "M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z" }, null, -1);
const _hoisted_4$8 = [
  _hoisted_2$b,
  _hoisted_3$9
];
function _sfc_render$2(_ctx, _cache) {
  return openBlock(), createElementBlock("svg", _hoisted_1$d, _hoisted_4$8);
}
const DownloadIcon = /* @__PURE__ */ _export_sfc(_sfc_main$d, [["render", _sfc_render$2]]);
const _withScopeId$6 = (n) => (pushScopeId("data-v-2dff21be"), n = n(), popScopeId(), n);
const _hoisted_1$c = { class: "field" };
const _hoisted_2$a = {
  class: "field-label",
  for: "user_public_key"
};
const _hoisted_3$8 = /* @__PURE__ */ _withScopeId$6(() => /* @__PURE__ */ createBaseVNode("strong", null, "Profile's public key or event id", -1));
const _hoisted_4$7 = { class: "field-elements" };
const _hoisted_5$4 = { class: "error" };
const _hoisted_6$3 = {
  key: 0,
  class: "loading-notice"
};
const _hoisted_7$2 = { class: "user" };
const _hoisted_8$2 = {
  key: 0,
  class: "user__avatar-wrapper"
};
const _hoisted_9$2 = ["src"];
const _hoisted_10$2 = { class: "user__info" };
const _hoisted_11$2 = { class: "user__nickname" };
const _hoisted_12$2 = { class: "user__name" };
const _hoisted_13$2 = { class: "user__desc" };
const _hoisted_14$2 = {
  key: 0,
  class: "user__nip05"
};
const _hoisted_15$2 = ["href"];
const _hoisted_16$2 = /* @__PURE__ */ _withScopeId$6(() => /* @__PURE__ */ createBaseVNode("strong", null, "nip05", -1));
const _hoisted_17$2 = {
  key: 1,
  class: "user__contacts"
};
const _hoisted_18$1 = { class: "user__contacts-col user__following-cnt" };
const _hoisted_19$1 = { class: "user__contacts-col user__followers-cnt" };
const _hoisted_20$1 = { key: 0 };
const _hoisted_21$1 = {
  key: 1,
  class: "user__contacts-download-icon"
};
const _hoisted_22$1 = /* @__PURE__ */ _withScopeId$6(() => /* @__PURE__ */ createBaseVNode("span", { class: "user__contacts-followers-word" }, " Followers ", -1));
const _hoisted_23$1 = { key: 2 };
const _hoisted_24$1 = {
  key: 3,
  id: "user-posts"
};
const _hoisted_25$1 = { key: 0 };
const _hoisted_26$1 = { key: 1 };
const _hoisted_27$1 = {
  key: 5,
  class: "not-found"
};
const _hoisted_28$1 = /* @__PURE__ */ _withScopeId$6(() => /* @__PURE__ */ createBaseVNode("div", { class: "not-found__desc" }, " Data was not found on selected relay. Please try to connect to another one or you can try to load info from the list of popular relays: ", -1));
const _sfc_main$c = /* @__PURE__ */ defineComponent({
  __name: "User",
  props: {
    handleRelayConnect: { type: Function }
  },
  setup(__props) {
    const poolStore = usePool();
    const pool = poolStore.pool;
    const npubStore = useNpub();
    const userNotesStore = useUserNotes();
    const userStore = useUser();
    const imagesStore = useImages();
    const nsecStore = useNsec();
    const relayStore = useRelay();
    const props = __props;
    const userEvent = ref({});
    const userDetails = ref({});
    const isUserHasValidNip05 = ref(false);
    const isUsingFallbackSearch = ref(false);
    const pubKeyError = ref("");
    const showNotFoundError = ref(false);
    const pubHex = ref("");
    const showLoadingUser = ref(false);
    const notFoundFallbackError = ref("");
    const isLoadingFallback = ref(false);
    const showLoadingTextNotes = ref(false);
    const isAutoConnectOnSearch = ref(false);
    const isEventSearch = ref(false);
    const isRootEventSearch = ref(true);
    const currentPage = ref(1);
    const pagesCount = computed(() => Math.ceil(userNotesStore.allNotesIds.length / DEFAULT_EVENTS_COUNT));
    const router2 = useRouter();
    const route = useRoute();
    const nip05toURL = (identifier) => {
      const [name, domain] = identifier.split("@");
      return `https://${domain}/.well-known/nostr.json?name=${name}`;
    };
    const currentReadRelays = ref([]);
    onMounted(() => {
      var _a, _b;
      if (((_b = (_a = route.params) == null ? void 0 : _a.id) == null ? void 0 : _b.length) && !relayStore.currentRelay.connected) {
        npubStore.updateNpubInput(route.params.id);
        npubStore.updateCachedUrl(route.params.id);
        if (!relayStore.currentRelay.connected) {
          isAutoConnectOnSearch.value = true;
        }
        return;
      }
      if (userStore.isRoutingUser && npubStore.npubInput.length) {
        npubStore.updateCachedUrl(npubStore.npubInput);
        userStore.updateRoutingStatus(false);
        handleGetUserInfo();
        return;
      }
    });
    watch(
      () => route.params,
      () => {
        if (userStore.isRoutingUser) {
          npubStore.updateCachedUrl(npubStore.npubInput);
          userStore.updateRoutingStatus(false);
          handleGetUserInfo();
        }
      }
    );
    watch(
      () => route.redirectedFrom,
      () => {
        npubStore.updateNpubInput(route.params.id);
        npubStore.updateCachedUrl(route.params.id);
        flushData();
      }
    );
    onBeforeMount(() => {
      if (userNotesStore.notes.length) {
        handleGetUserInfo();
      }
    });
    const handleInputNpub = () => {
      notFoundFallbackError.value = "";
      showNotFoundError.value = false;
    };
    const showUserPage = async (page) => {
      const relays = relayStore.connectedUserReadRelayUrlsWithSelectedRelay;
      if (!relays.length)
        return;
      const limit = DEFAULT_EVENTS_COUNT;
      const start = (page - 1) * limit;
      const end = start + limit;
      const idsToShow = userNotesStore.allNotesIds.slice(start, end);
      const postsEvents = await pool.querySync(relays, { ids: idsToShow });
      let posts = injectAuthorToUserNotes(postsEvents, userDetails.value);
      await injectDataToRootNotes(posts, relays, pool);
      userNotesStore.updateNotes(posts);
      currentPage.value = page;
    };
    const flushData = () => {
      userEvent.value = {};
      userDetails.value = {};
      userNotesStore.updateNotes([]);
      userNotesStore.updateIds([]);
    };
    const handleGetUserInfo = async () => {
      gettingUserInfoId.update(gettingUserInfoId.value + 1);
      const currentOperationId = gettingUserInfoId.value;
      const searchVal = npubStore.npubInput.trim();
      let isHexSearch = false;
      if (!searchVal.length) {
        pubKeyError.value = "Public key or event id is required.";
        return;
      }
      if (isSHA256Hex(searchVal)) {
        pubHex.value = searchVal;
        isHexSearch = true;
      } else {
        try {
          let { data, type } = nip19_exports.decode(searchVal);
          if (type !== "npub" && type !== "note") {
            pubKeyError.value = "Public key or event id should be in npub or note format, or hex.";
            return;
          }
          isEventSearch.value = type === "note";
          pubHex.value = data.toString();
        } catch (e) {
          pubKeyError.value = "Public key or event id is invalid. Please check it and try again.";
          return;
        }
      }
      if (isAutoConnectOnSearch.value) {
        await props.handleRelayConnect();
      }
      const relays = relayStore.connectedUserReadRelayUrlsWithSelectedRelay;
      if (currentOperationId !== gettingUserInfoId.value)
        return;
      if (!relays.length) {
        pubKeyError.value = isAutoConnectOnSearch.value ? "Connection error, try to connect again or try to choose other relay." : "Please connect to relay first.";
        return;
      }
      isAutoConnectOnSearch.value = false;
      flushData();
      isUsingFallbackSearch.value = false;
      pubKeyError.value = "";
      showLoadingUser.value = true;
      let notesEvents = [];
      if (isEventSearch.value || isHexSearch) {
        const eventId = pubHex.value;
        notesEvents = await pool.querySync(relays, { ids: [eventId] });
        if (currentOperationId !== gettingUserInfoId.value)
          return;
        if (notesEvents.length) {
          userNotesStore.updateIds(notesEvents.map((event) => event.id));
          pubHex.value = notesEvents[0].pubkey;
          isEventSearch.value = true;
        }
      }
      const authorMeta = await pool.get(relays, { kinds: [0], limit: 1, authors: [pubHex.value] });
      if (currentOperationId !== gettingUserInfoId.value)
        return;
      if (!authorMeta) {
        showLoadingUser.value = false;
        showNotFoundError.value = true;
        return;
      }
      currentReadRelays.value = relays;
      const authorContacts = await pool.get(relays, { kinds: [3], limit: 1, authors: [pubHex.value] });
      if (currentOperationId !== gettingUserInfoId.value)
        return;
      userEvent.value = authorMeta;
      userDetails.value = JSON.parse(authorMeta.content);
      userDetails.value.followingCount = (authorContacts == null ? void 0 : authorContacts.tags.length) || 0;
      isUserHasValidNip05.value = false;
      showLoadingUser.value = false;
      showNotFoundError.value = false;
      if (isEventSearch.value) {
        router2.push({ path: `/event/${searchVal}` });
      } else {
        router2.push({ path: `/user/${searchVal}` });
      }
      npubStore.updateCachedUrl(searchVal);
      showLoadingTextNotes.value = true;
      checkAndShowNip05(currentOperationId);
      if (!isEventSearch.value) {
        notesEvents = await pool.querySync(relays, { kinds: [1], authors: [pubHex.value] });
        if (currentOperationId !== gettingUserInfoId.value)
          return;
        const repliesIds = /* @__PURE__ */ new Set();
        notesEvents.forEach((event) => {
          const nip10Data = nip10_exports.parse(event);
          if (nip10Data.reply || nip10Data.root) {
            repliesIds.add(event.id);
          }
        });
        notesEvents = notesEvents.filter((event) => !repliesIds.has(event.id));
        userNotesStore.updateIds(notesEvents.map((event) => event.id));
        const limit = DEFAULT_EVENTS_COUNT;
        currentPage.value = 1;
        notesEvents = notesEvents.slice(0, limit);
      }
      notesEvents = injectAuthorToUserNotes(notesEvents, userDetails.value);
      if (isEventSearch.value) {
        const event = notesEvents[0];
        const nip10Data = nip10_exports.parse(event);
        const nip10ParentEvent = nip10Data.reply || nip10Data.root;
        if (nip10ParentEvent) {
          isRootEventSearch.value = false;
          let parentEvent = await pool.get(currentReadRelays.value, { kinds: [1], ids: [nip10ParentEvent.id] });
          if (parentEvent) {
            const authorMeta2 = await pool.get(currentReadRelays.value, { kinds: [0], authors: [parentEvent.pubkey] });
            if (authorMeta2) {
              parentEvent.author = JSON.parse(authorMeta2.content);
            }
          }
          await injectDataToReplyNotes(parentEvent, notesEvents, currentReadRelays.value, pool);
        } else {
          await injectDataToRootNotes(notesEvents, relays, pool);
        }
      } else {
        await injectDataToRootNotes(notesEvents, relays, pool);
      }
      if (currentOperationId !== gettingUserInfoId.value)
        return;
      userNotesStore.updateNotes(notesEvents);
      showLoadingTextNotes.value = false;
    };
    const injectAuthorToUserNotes = (notes, details) => {
      return notes.map((note) => {
        note.author = details;
        return note;
      });
    };
    const checkAndShowNip05 = async (currentOperationId = 0) => {
      const nip05Identifier = userDetails.value.nip05;
      const userPubkey = userEvent.value.pubkey;
      if (!nip05Identifier || !userPubkey)
        return;
      try {
        const validNip = await isValidNip05(nip05Identifier, userPubkey);
        if (currentOperationId && currentOperationId !== gettingUserInfoId.value) {
          return;
        }
        isUserHasValidNip05.value = validNip;
      } catch (e) {
        console.log("Failed to check nip05");
      }
    };
    const isValidNip05 = async (identifier, metaEventPubkey) => {
      const profile = await nip05_exports.queryProfile(identifier);
      return metaEventPubkey === (profile == null ? void 0 : profile.pubkey);
    };
    const handleGeneratePublicFromPrivate = () => {
      const nsecVal = nsecStore.nsec.trim();
      if (!nsecVal.length) {
        pubKeyError.value = "Please provide private key first.";
        return;
      }
      try {
        const pubkey = nsecStore.getPubkey();
        if (!pubkey.length) {
          throw new Error();
        }
        npubStore.updateNpubInput(nip19_exports.npubEncode(pubkey));
        pubKeyError.value = "";
      } catch (e) {
        pubKeyError.value = "Private key is invalid. Please check it and try again.";
        return;
      }
    };
    const handleSearchFallback = async () => {
      const searchVal = npubStore.npubInput.trim();
      let isHexSearch = false;
      if (!searchVal.length) {
        notFoundFallbackError.value = "Public key or event id is required.";
        return;
      }
      if (isSHA256Hex(searchVal)) {
        pubHex.value = searchVal;
        isHexSearch = true;
      } else {
        try {
          let { data, type } = nip19_exports.decode(searchVal);
          if (type !== "npub" && type !== "note") {
            notFoundFallbackError.value = "Public key or event id should be in npub or note format, or hex.";
            return;
          }
          isEventSearch.value = type === "note";
          pubHex.value = data.toString();
        } catch (e) {
          notFoundFallbackError.value = "Public key or event id is invalid. Please check it and try again.";
          return;
        }
      }
      isLoadingFallback.value = true;
      userNotesStore.updateIds([]);
      let notesEvents = [];
      if (isEventSearch.value || isHexSearch) {
        const eventId = pubHex.value;
        notesEvents = await pool.querySync(fallbackRelays, { ids: [eventId] });
        if (notesEvents.length) {
          pubHex.value = notesEvents[0].pubkey;
          isEventSearch.value = true;
        }
      }
      const authorMeta = await pool.get(fallbackRelays, { kinds: [0], limit: 1, authors: [pubHex.value] });
      if (!authorMeta) {
        isLoadingFallback.value = false;
        notFoundFallbackError.value = "User was not found on listed relays.";
        return;
      }
      currentReadRelays.value = fallbackRelays;
      const authorContacts = await pool.get(fallbackRelays, { kinds: [3], limit: 1, authors: [pubHex.value] });
      userEvent.value = authorMeta;
      userDetails.value = JSON.parse(authorMeta.content);
      userDetails.value.followingCount = (authorContacts == null ? void 0 : authorContacts.tags.length) || 0;
      notFoundFallbackError.value = "";
      isLoadingFallback.value = false;
      showNotFoundError.value = false;
      isUsingFallbackSearch.value = true;
      isUserHasValidNip05.value = false;
      if (isEventSearch.value) {
        router2.push({ path: `/event/${searchVal}` });
      } else {
        router2.push({ path: `/user/${searchVal}` });
      }
      npubStore.updateCachedUrl(searchVal);
      showLoadingTextNotes.value = true;
      checkAndShowNip05();
      if (!isEventSearch.value) {
        notesEvents = await pool.querySync(fallbackRelays, { kinds: [1], authors: [pubHex.value] });
        const repliesIds = /* @__PURE__ */ new Set();
        notesEvents.forEach((event) => {
          const nip10Data = nip10_exports.parse(event);
          if (nip10Data.reply || nip10Data.root) {
            repliesIds.add(event.id);
          }
        });
        notesEvents = notesEvents.filter((event) => !repliesIds.has(event.id));
      }
      notesEvents = injectAuthorToUserNotes(notesEvents, userDetails.value);
      await injectDataToRootNotes(notesEvents, fallbackRelays, pool);
      userNotesStore.updateNotes(notesEvents);
      showLoadingTextNotes.value = false;
    };
    const handleLoadUserFollowers = async () => {
      userDetails.value.followersCount = 0;
      const sub = pool.subscribeMany(
        currentReadRelays.value,
        [{ "#p": [pubHex.value], kinds: [3] }],
        {
          onevent(event) {
            userDetails.value.followersCount = userDetails.value.followersCount + 1;
          },
          oneose() {
            sub.close();
          }
        }
      );
    };
    const handleToggleRawData = (eventId) => {
      userNotesStore.toggleRawData(eventId);
    };
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock(Fragment, null, [
        createBaseVNode("div", _hoisted_1$c, [
          createBaseVNode("label", _hoisted_2$a, [
            _hoisted_3$8,
            unref(nsecStore).nsec.length ? (openBlock(), createElementBlock("button", {
              key: 0,
              onClick: handleGeneratePublicFromPrivate,
              class: "random-key-btn"
            }, "Use mine")) : createCommentVNode("", true)
          ]),
          createBaseVNode("div", _hoisted_4$7, [
            withDirectives(createBaseVNode("input", {
              onInput: handleInputNpub,
              "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => unref(npubStore).npubInput = $event),
              class: "pubkey-input",
              id: "user_public_key",
              type: "text",
              placeholder: "npub, note, hex of pubkey or note id..."
            }, null, 544), [
              [vModelText, unref(npubStore).npubInput]
            ]),
            createBaseVNode("button", {
              onClick: handleGetUserInfo,
              class: "get-user-btn"
            }, toDisplayString(isAutoConnectOnSearch.value ? "Connect & Search" : "Search"), 1)
          ]),
          createBaseVNode("div", _hoisted_5$4, toDisplayString(pubKeyError.value), 1)
        ]),
        showLoadingUser.value ? (openBlock(), createElementBlock("div", _hoisted_6$3, " Loading event info... ")) : createCommentVNode("", true),
        userEvent.value.id ? (openBlock(), createBlock(UserEvent, {
          author: userDetails.value,
          event: userEvent.value,
          key: userEvent.value.id
        }, {
          default: withCtx(() => [
            createBaseVNode("div", _hoisted_7$2, [
              unref(imagesStore).showImages ? (openBlock(), createElementBlock("div", _hoisted_8$2, [
                createBaseVNode("img", {
                  class: "user__avatar",
                  src: userDetails.value.picture
                }, null, 8, _hoisted_9$2)
              ])) : createCommentVNode("", true),
              createBaseVNode("div", _hoisted_10$2, [
                createBaseVNode("div", null, [
                  createBaseVNode("div", _hoisted_11$2, toDisplayString(userDetails.value.username || userDetails.value.name), 1),
                  createBaseVNode("div", _hoisted_12$2, toDisplayString(userDetails.value.display_name || ""), 1),
                  createBaseVNode("div", _hoisted_13$2, toDisplayString(userDetails.value.about || ""), 1),
                  isUserHasValidNip05.value ? (openBlock(), createElementBlock("div", _hoisted_14$2, [
                    createBaseVNode("a", {
                      target: "_blank",
                      href: nip05toURL(userDetails.value.nip05)
                    }, [
                      _hoisted_16$2,
                      createTextVNode(": " + toDisplayString(userDetails.value.nip05), 1)
                    ], 8, _hoisted_15$2)
                  ])) : createCommentVNode("", true),
                  userDetails.value.followingCount >= 0 ? (openBlock(), createElementBlock("div", _hoisted_17$2, [
                    createBaseVNode("span", _hoisted_18$1, [
                      createBaseVNode("b", null, toDisplayString(userDetails.value.followingCount), 1),
                      createTextVNode(" Following ")
                    ]),
                    createBaseVNode("span", _hoisted_19$1, [
                      userDetails.value.followersCount ? (openBlock(), createElementBlock("b", _hoisted_20$1, toDisplayString(userDetails.value.followersCount), 1)) : (openBlock(), createElementBlock("span", _hoisted_21$1, [
                        createVNode(DownloadIcon, { onClick: handleLoadUserFollowers })
                      ])),
                      _hoisted_22$1
                    ])
                  ])) : createCommentVNode("", true)
                ])
              ])
            ])
          ]),
          _: 1
        }, 8, ["author", "event"])) : createCommentVNode("", true),
        showLoadingTextNotes.value ? (openBlock(), createElementBlock("div", _hoisted_23$1, "Loading notes...")) : createCommentVNode("", true),
        unref(userNotesStore).notes.length > 0 && !showLoadingTextNotes.value ? (openBlock(), createElementBlock("h3", _hoisted_24$1, [
          isEventSearch.value ? (openBlock(), createElementBlock("span", _hoisted_25$1, "Event info")) : (openBlock(), createElementBlock("span", _hoisted_26$1, "User notes"))
        ])) : createCommentVNode("", true),
        (openBlock(true), createElementBlock(Fragment, null, renderList(unref(userNotesStore).notes, (event, i2) => {
          return openBlock(), createBlock(ParentEventView, {
            key: event.id,
            hasReplyBtn: true,
            showReplies: true,
            showRootReplies: isRootEventSearch.value,
            currentReadRelays: currentReadRelays.value,
            index: i2,
            onToggleRawData: handleToggleRawData,
            event
          }, null, 8, ["showRootReplies", "currentReadRelays", "index", "event"]);
        }), 128)),
        !showLoadingTextNotes.value && !showLoadingUser.value ? (openBlock(), createBlock(Pagination, {
          key: 4,
          pagesCount: pagesCount.value,
          currentPage: currentPage.value,
          onShowPage: showUserPage
        }, null, 8, ["pagesCount", "currentPage"])) : createCommentVNode("", true),
        showNotFoundError.value ? (openBlock(), createElementBlock("div", _hoisted_27$1, [
          _hoisted_28$1,
          createBaseVNode("div", null, [
            createBaseVNode("button", {
              onClick: handleSearchFallback,
              class: "fallback-search-btn"
            }, " Search in all listed relays "),
            createBaseVNode("div", {
              class: normalizeClass(["not-found__status", { "error": notFoundFallbackError.value.length }])
            }, toDisplayString(notFoundFallbackError.value) + " " + toDisplayString(isLoadingFallback.value ? "Searching..." : ""), 3),
            createBaseVNode("ul", null, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(unref(fallbackRelays), (relay) => {
                return openBlock(), createElementBlock("li", null, toDisplayString(relay), 1);
              }), 256))
            ])
          ])
        ])) : createCommentVNode("", true)
      ], 64);
    };
  }
});
const User_vue_vue_type_style_index_0_scoped_2dff21be_lang = "";
const User = /* @__PURE__ */ _export_sfc(_sfc_main$c, [["__scopeId", "data-v-2dff21be"]]);
const _sfc_main$b = {};
const _hoisted_1$b = {
  xmlns: "http://www.w3.org/2000/svg",
  width: "16",
  height: "16",
  fill: "currentColor",
  class: "bi bi-trash",
  viewBox: "0 0 16 16"
};
const _hoisted_2$9 = /* @__PURE__ */ createBaseVNode("path", { d: "M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z" }, null, -1);
const _hoisted_3$7 = /* @__PURE__ */ createBaseVNode("path", { d: "M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z" }, null, -1);
const _hoisted_4$6 = [
  _hoisted_2$9,
  _hoisted_3$7
];
function _sfc_render$1(_ctx, _cache) {
  return openBlock(), createElementBlock("svg", _hoisted_1$b, _hoisted_4$6);
}
const TrashIcon = /* @__PURE__ */ _export_sfc(_sfc_main$b, [["render", _sfc_render$1]]);
const _hoisted_1$a = { class: "show-images" };
const _hoisted_2$8 = { class: "show-images__field" };
const _hoisted_3$6 = ["checked"];
const _hoisted_4$5 = /* @__PURE__ */ createBaseVNode("label", {
  class: "show-images__label",
  for: "show-feed-images"
}, " Show avatars", -1);
const _sfc_main$a = /* @__PURE__ */ defineComponent({
  __name: "ShowImagesCheckbox",
  props: {
    showImages: { type: Boolean }
  },
  emits: ["toggleImages"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit2 = __emit;
    return (_ctx, _cache) => {
      const _component_router_link = resolveComponent("router-link");
      return openBlock(), createElementBlock("div", _hoisted_1$a, [
        createBaseVNode("span", _hoisted_2$8, [
          createBaseVNode("input", {
            onChange: _cache[0] || (_cache[0] = ($event) => emit2("toggleImages")),
            class: "show-images__input",
            type: "checkbox",
            id: "show-feed-images",
            checked: props.showImages
          }, null, 40, _hoisted_3$6),
          _hoisted_4$5
        ]),
        createBaseVNode("small", null, [
          createTextVNode(" ("),
          createVNode(_component_router_link, { to: { path: "/help", hash: "#privacy" } }, {
            default: withCtx(() => [
              createTextVNode("Exposes your IP")
            ]),
            _: 1
          }),
          createTextVNode(")")
        ])
      ]);
    };
  }
});
const ShowImagesCheckbox_vue_vue_type_style_index_0_lang = "";
const _withScopeId$5 = (n) => (pushScopeId("data-v-d5b9796a"), n = n(), popScopeId(), n);
const _hoisted_1$9 = /* @__PURE__ */ _withScopeId$5(() => /* @__PURE__ */ createBaseVNode("h4", null, "Images:", -1));
const _hoisted_2$7 = { class: "show-images" };
const _hoisted_3$5 = /* @__PURE__ */ _withScopeId$5(() => /* @__PURE__ */ createBaseVNode("h4", null, "Your relays:", -1));
const _hoisted_4$4 = { class: "error" };
const _hoisted_5$3 = { class: "relays" };
const _hoisted_6$2 = { class: "relay" };
const _hoisted_7$1 = { class: "actions" };
const _hoisted_8$1 = ["onChange", "id", "name", "checked"];
const _hoisted_9$1 = ["for"];
const _hoisted_10$1 = /* @__PURE__ */ _withScopeId$5(() => /* @__PURE__ */ createBaseVNode("span", { class: "actions__delimiter" }, " | ", -1));
const _hoisted_11$1 = ["onClick"];
const _hoisted_12$1 = /* @__PURE__ */ _withScopeId$5(() => /* @__PURE__ */ createBaseVNode("span", { class: "actions__remove-label" }, "remove", -1));
const _hoisted_13$1 = { key: 0 };
const _hoisted_14$1 = { key: 0 };
const _hoisted_15$1 = { key: 1 };
const _hoisted_16$1 = /* @__PURE__ */ _withScopeId$5(() => /* @__PURE__ */ createBaseVNode("h4", null, "Add relay:", -1));
const _hoisted_17$1 = { class: "add-relay" };
const _hoisted_18 = { class: "error" };
const _hoisted_19 = /* @__PURE__ */ _withScopeId$5(() => /* @__PURE__ */ createBaseVNode("h4", null, "Your Keys:", -1));
const _hoisted_20 = { class: "keys" };
const _hoisted_21 = { class: "key-block" };
const _hoisted_22 = /* @__PURE__ */ _withScopeId$5(() => /* @__PURE__ */ createBaseVNode("div", null, " Public key: ", -1));
const _hoisted_23 = /* @__PURE__ */ _withScopeId$5(() => /* @__PURE__ */ createBaseVNode("div", { class: "key-block__desc" }, [
  /* @__PURE__ */ createBaseVNode("small", null, " Public key identifies your Nostr account. Feel free to share it with others. ")
], -1));
const _hoisted_24 = {
  key: 0,
  class: "key-block__code"
};
const _hoisted_25 = { key: 1 };
const _hoisted_26 = { class: "key-block" };
const _hoisted_27 = /* @__PURE__ */ _withScopeId$5(() => /* @__PURE__ */ createBaseVNode("div", null, " Private key: ", -1));
const _hoisted_28 = /* @__PURE__ */ _withScopeId$5(() => /* @__PURE__ */ createBaseVNode("div", { class: "key-block__desc" }, [
  /* @__PURE__ */ createBaseVNode("small", null, [
    /* @__PURE__ */ createTextVNode(" Private key fully controls your Nostr account and used to cryptographically sign your messages. "),
    /* @__PURE__ */ createBaseVNode("b", null, "Do not share your private key with anyone and keep it secure.")
  ])
], -1));
const _hoisted_29 = {
  key: 0,
  class: "key-block__code"
};
const _hoisted_30 = { key: 1 };
const UPDATING_RELAY_ERROR = "Updating relays error. Please reload the page and try again or write us about the issue.";
const _sfc_main$9 = /* @__PURE__ */ defineComponent({
  __name: "Settings",
  props: {
    handleRelayConnect: { type: Function }
  },
  setup(__props) {
    const props = __props;
    const poolStore = usePool();
    const nsecStore = useNsec();
    const imagesStore = useImages();
    const pool = poolStore.pool;
    const relayStore = useRelay();
    const newRelayUrl = ref("");
    const relayUrlError = ref("");
    const relaysError = ref("");
    const prepareNip65Event = (tags) => {
      relaysError.value = "";
      const nsecValue = nsecStore.nsec ? nsecStore.nsec.trim() : "";
      if (!nsecValue.length) {
        relaysError.value = "Please provide your private key.";
        return;
      }
      let privkey;
      let pubkey;
      try {
        privkey = nsecStore.getPrivkeyBytes();
        if (!privkey) {
          throw new Error();
        }
        pubkey = nsecStore.getPubkey();
        if (!pubkey.length) {
          throw new Error();
        }
      } catch (e) {
        relaysError.value = `Invalid private key. Please check it and try again.`;
        return;
      }
      const event = {
        kind: 10002,
        pubkey,
        created_at: Math.floor(Date.now() / 1e3),
        content: "",
        tags
      };
      return finalizeEvent(event, privkey);
    };
    const handleWriteClick = async (e, relay) => {
      relaysError.value = "";
      const isChecked = e.target.checked;
      if (isChecked) {
        relayStore.addWriteRelay(relay);
      } else {
        relayStore.removeWriteRelay(relay);
      }
      const tags = relayStore.nip65Tags;
      const signedEvent = prepareNip65Event(tags);
      if (signedEvent) {
        return await pool.publish(relayStore.allRelaysUrlsWithSelectedRelay, signedEvent);
      }
      if (!relaysError.value.length) {
        relaysError.value = UPDATING_RELAY_ERROR;
      }
    };
    const handleRemoveClick = async (relay) => {
      relaysError.value = "";
      relayStore.removeUserRelay(relay);
      props.handleRelayConnect(true);
      const tags = relayStore.nip65Tags;
      const signedEvent = prepareNip65Event(tags);
      if (signedEvent) {
        return await pool.publish(relayStore.allRelaysUrlsWithSelectedRelay, signedEvent);
      }
      if (!relaysError.value.length) {
        relaysError.value = UPDATING_RELAY_ERROR;
      }
    };
    const handleAddRelay = async () => {
      let relay = "";
      relaysError.value = "";
      relayUrlError.value = "";
      try {
        relay = utils_exports.normalizeURL(newRelayUrl.value);
      } catch (e) {
        relayUrlError.value = "Invalid relay url.";
        return;
      }
      relayStore.addUserRelay(relay);
      props.handleRelayConnect(true);
      newRelayUrl.value = "";
      const tags = relayStore.nip65Tags;
      const signedEvent = prepareNip65Event(tags);
      if (signedEvent) {
        return await pool.publish(relayStore.allRelaysUrlsWithSelectedRelay, signedEvent);
      }
      if (!relaysError.value.length) {
        relaysError.value = UPDATING_RELAY_ERROR;
      }
    };
    const toggleImages = () => {
      imagesStore.updateShowImages(!imagesStore.showImages);
    };
    const handleCopyPubkeyNpub = () => {
      if (!nsecStore.isValidNsecPresented())
        return;
      const pubkey = nsecStore.getPubkey();
      navigator.clipboard.writeText(nip19_exports.npubEncode(pubkey));
    };
    const handleCopyPubkeyHex = () => {
      if (!nsecStore.isValidNsecPresented())
        return;
      navigator.clipboard.writeText(nsecStore.getPubkey());
    };
    const handleCopyPrivkeyNsec = () => {
      if (!nsecStore.isValidNsecPresented())
        return;
      navigator.clipboard.writeText(nsecStore.getPrivkey());
    };
    const handleCopyPrivkeyHex = () => {
      if (!nsecStore.isValidNsecPresented())
        return;
      navigator.clipboard.writeText(nsecStore.getPrivkeyHex());
    };
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock(Fragment, null, [
        _hoisted_1$9,
        createBaseVNode("div", _hoisted_2$7, [
          createVNode(_sfc_main$a, {
            showImages: unref(imagesStore).showImages,
            onToggleImages: toggleImages
          }, null, 8, ["showImages"])
        ]),
        _hoisted_3$5,
        createBaseVNode("div", _hoisted_4$4, toDisplayString(relaysError.value), 1),
        createBaseVNode("ul", _hoisted_5$3, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(unref(relayStore).userReadWriteRelays, (r, i2) => {
            return openBlock(), createElementBlock("li", _hoisted_6$2, [
              createTextVNode(toDisplayString(r.url) + " ", 1),
              createBaseVNode("div", _hoisted_7$1, [
                createBaseVNode("input", {
                  onChange: (e) => handleWriteClick(e, r.url),
                  class: "actions__checkbox",
                  type: "checkbox",
                  id: `write-${i2}`,
                  name: `write-${i2}`,
                  checked: r.type === "write"
                }, null, 40, _hoisted_8$1),
                createBaseVNode("label", {
                  class: "actions__label",
                  for: `write-${i2}`
                }, " publish to relay", 8, _hoisted_9$1),
                _hoisted_10$1,
                createBaseVNode("span", {
                  onClick: () => handleRemoveClick(r.url),
                  class: "actions__remove"
                }, [
                  createVNode(TrashIcon, { class: "trash-icon" }),
                  _hoisted_12$1
                ], 8, _hoisted_11$1)
              ])
            ]);
          }), 256))
        ]),
        !unref(relayStore).userReadWriteRelays.length ? (openBlock(), createElementBlock("div", _hoisted_13$1, [
          unref(relayStore).isConnectedToRelay ? (openBlock(), createElementBlock("span", _hoisted_14$1, [
            createTextVNode(" The private key was not provided or the list with your relays was not found on "),
            createBaseVNode("b", null, toDisplayString(unref(relayStore).currentRelay.url), 1)
          ])) : (openBlock(), createElementBlock("span", _hoisted_15$1, " Please connect to a relay to see the list of your relays. "))
        ])) : createCommentVNode("", true),
        _hoisted_16$1,
        createBaseVNode("div", _hoisted_17$1, [
          withDirectives(createBaseVNode("input", {
            "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => newRelayUrl.value = $event),
            class: "add-relay__input",
            type: "text",
            placeholder: "[wss://]relay.url"
          }, null, 512), [
            [vModelText, newRelayUrl.value]
          ]),
          createBaseVNode("button", {
            onClick: handleAddRelay,
            class: "add-relay__btn"
          }, "Add")
        ]),
        createBaseVNode("div", _hoisted_18, toDisplayString(relayUrlError.value), 1),
        _hoisted_19,
        createBaseVNode("div", _hoisted_20, [
          createBaseVNode("div", _hoisted_21, [
            _hoisted_22,
            _hoisted_23,
            createBaseVNode("div", null, [
              createTextVNode(" 🔑  "),
              unref(nsecStore).isValidNsecPresented() ? (openBlock(), createElementBlock("code", _hoisted_24, toDisplayString(unref(nip19_exports).npubEncode(unref(nsecStore).getPubkey())), 1)) : (openBlock(), createElementBlock("span", _hoisted_25, "Please login to get the key."))
            ]),
            createBaseVNode("div", { class: "key-block__btns" }, [
              createBaseVNode("button", { onClick: handleCopyPubkeyNpub }, " Copy pubkey "),
              createBaseVNode("button", { onClick: handleCopyPubkeyHex }, " Copy hex ")
            ])
          ]),
          createBaseVNode("div", _hoisted_26, [
            _hoisted_27,
            _hoisted_28,
            createBaseVNode("div", null, [
              createTextVNode(" 🔐  "),
              unref(nsecStore).isValidNsecPresented() ? (openBlock(), createElementBlock("code", _hoisted_29, " *************************************************************** ")) : (openBlock(), createElementBlock("span", _hoisted_30, "Please login to get the key."))
            ]),
            createBaseVNode("div", { class: "key-block__btns" }, [
              createBaseVNode("button", { onClick: handleCopyPrivkeyNsec }, " Copy privkey "),
              createBaseVNode("button", { onClick: handleCopyPrivkeyHex }, " Copy hex ")
            ])
          ])
        ])
      ], 64);
    };
  }
});
const Settings_vue_vue_type_style_index_0_scoped_d5b9796a_lang = "";
const Settings = /* @__PURE__ */ _export_sfc(_sfc_main$9, [["__scopeId", "data-v-d5b9796a"]]);
const TWO_DAYS = 2 * 24 * 60 * 60;
const now = () => Math.round(Date.now() / 1e3);
const randomNow = () => Math.round(now() - Math.random() * TWO_DAYS);
const nip44ConversationKey = (privateKey, publicKey) => nip44_exports.v2.utils.getConversationKey(bytesToHex(privateKey), publicKey);
const nip44Encrypt = (data, privateKey, publicKey) => nip44_exports.v2.encrypt(JSON.stringify(data), nip44ConversationKey(privateKey, publicKey));
const nip44Decrypt = (data, privateKey) => JSON.parse(nip44_exports.v2.decrypt(data.content, nip44ConversationKey(privateKey, data.pubkey)));
const createRumor = (event, privateKey) => {
  const rumor = {
    kind: 14,
    created_at: now(),
    content: "",
    tags: [],
    ...event,
    pubkey: getPublicKey(privateKey)
  };
  rumor.id = getEventHash(rumor);
  return rumor;
};
const createSeal = (rumor, privateKey, recipientPublicKey) => {
  return finalizeEvent(
    {
      kind: 13,
      content: nip44Encrypt(rumor, privateKey, recipientPublicKey),
      created_at: randomNow(),
      tags: []
    },
    privateKey
  );
};
const createWrap = (event, recipientPublicKey) => {
  const randomPrivateKey = generateSecretKey();
  return finalizeEvent(
    {
      kind: 1059,
      content: nip44Encrypt(event, randomPrivateKey, recipientPublicKey),
      created_at: randomNow(),
      tags: [["p", recipientPublicKey]]
    },
    randomPrivateKey
  );
};
function setBigUint64(view, byteOffset, value, isLE2) {
  if (typeof view.setBigUint64 === "function")
    return view.setBigUint64(byteOffset, value, isLE2);
  const _32n = BigInt(32);
  const _u32_max = BigInt(4294967295);
  const wh = Number(value >> _32n & _u32_max);
  const wl = Number(value & _u32_max);
  const h2 = isLE2 ? 4 : 0;
  const l = isLE2 ? 0 : 4;
  view.setUint32(byteOffset + h2, wh, isLE2);
  view.setUint32(byteOffset + l, wl, isLE2);
}
const Chi = (a, b, c) => a & b ^ ~a & c;
const Maj = (a, b, c) => a & b ^ a & c ^ b & c;
class HashMD extends Hash3 {
  constructor(blockLen, outputLen, padOffset, isLE2) {
    super();
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE2;
    this.finished = false;
    this.length = 0;
    this.pos = 0;
    this.destroyed = false;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView(this.buffer);
  }
  update(data) {
    exists(this);
    const { view, buffer, blockLen } = this;
    data = toBytes(data);
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView(data);
        for (; blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
      }
    }
    this.length += data.length;
    this.roundClean();
    return this;
  }
  digestInto(out) {
    exists(this);
    output(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE: isLE2 } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    this.buffer.subarray(pos).fill(0);
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      pos = 0;
    }
    for (let i2 = pos; i2 < blockLen; i2++)
      buffer[i2] = 0;
    setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE2);
    this.process(view, 0);
    const oview = createView(out);
    const len = this.outputLen;
    if (len % 4)
      throw new Error("_sha2: outputLen should be aligned to 32bit");
    const outLen = len / 4;
    const state = this.get();
    if (outLen > state.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let i2 = 0; i2 < outLen; i2++)
      oview.setUint32(4 * i2, state[i2], isLE2);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneInto(to) {
    to || (to = new this.constructor());
    to.set(...this.get());
    const { blockLen, buffer, length, finished, destroyed, pos } = this;
    to.length = length;
    to.pos = pos;
    to.finished = finished;
    to.destroyed = destroyed;
    if (length % blockLen)
      to.buffer.set(buffer);
    return to;
  }
}
const SHA256_K = /* @__PURE__ */ new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
const SHA256_IV = /* @__PURE__ */ new Uint32Array([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);
const SHA256_W = /* @__PURE__ */ new Uint32Array(64);
class SHA2563 extends HashMD {
  constructor() {
    super(64, 32, 8, false);
    this.A = SHA256_IV[0] | 0;
    this.B = SHA256_IV[1] | 0;
    this.C = SHA256_IV[2] | 0;
    this.D = SHA256_IV[3] | 0;
    this.E = SHA256_IV[4] | 0;
    this.F = SHA256_IV[5] | 0;
    this.G = SHA256_IV[6] | 0;
    this.H = SHA256_IV[7] | 0;
  }
  get() {
    const { A, B, C, D, E, F, G, H } = this;
    return [A, B, C, D, E, F, G, H];
  }
  // prettier-ignore
  set(A, B, C, D, E, F, G, H) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D | 0;
    this.E = E | 0;
    this.F = F | 0;
    this.G = G | 0;
    this.H = H | 0;
  }
  process(view, offset) {
    for (let i2 = 0; i2 < 16; i2++, offset += 4)
      SHA256_W[i2] = view.getUint32(offset, false);
    for (let i2 = 16; i2 < 64; i2++) {
      const W15 = SHA256_W[i2 - 15];
      const W2 = SHA256_W[i2 - 2];
      const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
      const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
      SHA256_W[i2] = s1 + SHA256_W[i2 - 7] + s0 + SHA256_W[i2 - 16] | 0;
    }
    let { A, B, C, D, E, F, G, H } = this;
    for (let i2 = 0; i2 < 64; i2++) {
      const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
      const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i2] + SHA256_W[i2] | 0;
      const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
      const T2 = sigma0 + Maj(A, B, C) | 0;
      H = G;
      G = F;
      F = E;
      E = D + T1 | 0;
      D = C;
      C = B;
      B = A;
      A = T1 + T2 | 0;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D = D + this.D | 0;
    E = E + this.E | 0;
    F = F + this.F | 0;
    G = G + this.G | 0;
    H = H + this.H | 0;
    this.set(A, B, C, D, E, F, G, H);
  }
  roundClean() {
    SHA256_W.fill(0);
  }
  destroy() {
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    this.buffer.fill(0);
  }
}
const sha256 = /* @__PURE__ */ wrapConstructor(() => new SHA2563());
const injectChatTitle = async (chat, hostPubkey, relaysPool, relays) => {
  const pool = relaysPool || new SimplePool();
  const title = await getChatTitle(chat.messages, hostPubkey, pool, relays);
  chat.title = title;
  return chat;
};
const getChatTitle = async (messages, hostPubkey, pool, relays) => {
  const event = messages[0].event;
  const { pubkey, tags } = event;
  const tagsPubkeys = tags.filter((tag) => tag[0] === "p").map((tag) => tag[1]);
  const eventPubkeys = [pubkey, ...tagsPubkeys];
  const pubkeysSet = new Set(eventPubkeys);
  if (pubkeysSet.size > 2) {
    return `group of ${pubkeysSet.size} events`;
  }
  let filter = {};
  if (pubkeysSet.size === 1) {
    filter = { kinds: [0], authors: [pubkey] };
  } else if (pubkeysSet.size === 2) {
    const contactPubkey = eventPubkeys.filter((pb) => pb !== hostPubkey)[0];
    filter = { kinds: [0], authors: [contactPubkey] };
  }
  const meta = await pool.get(relays, filter);
  const author = JSON.parse((meta == null ? void 0 : meta.content) || "{}");
  if (author.display_name) {
    return author.display_name;
  } else if (author.name) {
    return author.name;
  } else if (author.username) {
    return author.username;
  } else {
    return nip19_exports.npubEncode(pubkey).slice(0, 10) + "...";
  }
};
const getNewChatTitle = async (pubkey, pool, relays) => {
  let filter = {};
  filter = { kinds: [0], authors: [pubkey] };
  const meta = await pool.get(relays, filter);
  const author = JSON.parse((meta == null ? void 0 : meta.content) || "{}");
  if (author.display_name) {
    return author.display_name;
  } else if (author.name) {
    return author.name;
  } else if (author.username) {
    return author.username;
  } else {
    return nip19_exports.npubEncode(pubkey).slice(0, 10) + "...";
  }
};
const getChatRoomHash = (event) => {
  const roomPubkeys = event.tags.filter((tag) => tag[0] === "p").map((tag) => tag[1]).sort();
  const strToHash = roomPubkeys.join("");
  return bytesToHex(sha256(strToHash));
};
const getNewChatRoomHash = (pubkeys) => {
  const strToHash = pubkeys.sort().join("");
  return bytesToHex(sha256(strToHash));
};
const getRumorFromWrap = (giftWrap, privateKey) => {
  const seal = nip44Decrypt(giftWrap, privateKey);
  const rumor = nip44Decrypt(seal, privateKey);
  if (seal.pubkey !== rumor.pubkey) {
    return null;
  }
  return rumor;
};
const getChatMessageFromRumor = (rumor) => {
  return {
    event: rumor,
    isPublished: true
  };
};
const isGroupChat = (rumor) => {
  const tagsPubkeys = rumor.tags.filter((tag) => (tag[0] === "r" || tag[0] === "relay") && tag[1] && tag[1].length).map((tag) => tag[1]);
  return tagsPubkeys.length > 2;
};
const useChat = defineStore("chat", () => {
  const ownRumors = ref(/* @__PURE__ */ new Set());
  function addOwnRumor(messageId) {
    ownRumors.value.add(messageId);
  }
  return { ownRumors, addOwnRumor };
});
const _hoisted_1$8 = {
  key: 0,
  class: "no-chats"
};
const _hoisted_2$6 = ["onClick"];
const _sfc_main$8 = /* @__PURE__ */ defineComponent({
  __name: "ChatsList",
  props: {
    chats: {},
    currentChatId: {},
    showChatsList: { type: Boolean },
    handleSelectChat: { type: Function }
  },
  setup(__props) {
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        class: normalizeClass(["chats__list", { "chats__list_mobile-hidden": !_ctx.showChatsList }])
      }, [
        !_ctx.chats.length ? (openBlock(), createElementBlock("div", _hoisted_1$8, " No chats yet... ")) : createCommentVNode("", true),
        (openBlock(true), createElementBlock(Fragment, null, renderList(_ctx.chats, (chat) => {
          return openBlock(), createElementBlock("div", {
            key: chat.id,
            class: normalizeClass(["chats__list-item", { "active": _ctx.currentChatId === chat.id }]),
            onClick: ($event) => _ctx.handleSelectChat(chat.id)
          }, [
            createBaseVNode("strong", null, toDisplayString(chat.title), 1)
          ], 10, _hoisted_2$6);
        }), 128))
      ], 2);
    };
  }
});
const ChatsList_vue_vue_type_style_index_0_scoped_8b709582_lang = "";
const ChatsList = /* @__PURE__ */ _export_sfc(_sfc_main$8, [["__scopeId", "data-v-8b709582"]]);
const _hoisted_1$7 = { class: "message-date" };
const _sfc_main$7 = /* @__PURE__ */ defineComponent({
  __name: "ChatMessagesList",
  props: {
    messages: {},
    userPubkey: {}
  },
  setup(__props) {
    return (_ctx, _cache) => {
      return openBlock(true), createElementBlock(Fragment, null, renderList(_ctx.messages, (msg) => {
        return openBlock(), createElementBlock("div", {
          class: normalizeClass(["message-line", { "own": msg.event.pubkey === _ctx.userPubkey }])
        }, [
          createBaseVNode("div", {
            class: normalizeClass(["message", { "own": msg.event.pubkey === _ctx.userPubkey }])
          }, [
            createBaseVNode("div", null, toDisplayString(msg.event.content), 1)
          ], 2),
          createBaseVNode("div", _hoisted_1$7, toDisplayString(msg.isPublished ? unref(formatedDateYear)(msg.event.created_at) : "sending..."), 1)
        ], 2);
      }), 256);
    };
  }
});
const ChatMessagesList_vue_vue_type_style_index_0_scoped_a4799345_lang = "";
const ChatMessagesList = /* @__PURE__ */ _export_sfc(_sfc_main$7, [["__scopeId", "data-v-a4799345"]]);
const _withScopeId$4 = (n) => (pushScopeId("data-v-05389505"), n = n(), popScopeId(), n);
const _hoisted_1$6 = { class: "chats__text-field" };
const _hoisted_2$5 = /* @__PURE__ */ _withScopeId$4(() => /* @__PURE__ */ createBaseVNode("button", {
  type: "submit",
  class: "chats__send-btn"
}, "Send", -1));
const _sfc_main$6 = /* @__PURE__ */ defineComponent({
  __name: "ChatMessageForm",
  props: {
    roomTags: {},
    recipientsPubkeys: {},
    userPubkey: {}
  },
  emits: ["preSendMessage"],
  setup(__props, { emit: __emit }) {
    const emit2 = __emit;
    const message = ref("");
    const nsecStore = useNsec();
    const props = __props;
    const prepareMessage = () => {
      const content = message.value;
      if (!content.length)
        return;
      const privateKey = nsecStore.getPrivkeyBytes();
      if (!privateKey)
        return;
      const tags = props.roomTags;
      if (!tags.length)
        return;
      const recipientsPubkeys = props.recipientsPubkeys;
      if (!recipientsPubkeys.length)
        return;
      const event = {
        content,
        tags
      };
      const wrapsBundle = [];
      let userRumor = null;
      recipientsPubkeys.forEach((recipientPubkey) => {
        const rumor = createRumor(event, privateKey);
        const seal = createSeal(rumor, privateKey, recipientPubkey);
        const wrap = createWrap(seal, recipientPubkey);
        wrapsBundle.push(wrap);
        if (recipientPubkey === props.userPubkey) {
          userRumor = rumor;
        }
      });
      message.value = "";
      emit2("preSendMessage", userRumor, wrapsBundle);
    };
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("form", {
        onSubmit: withModifiers(prepareMessage, ["prevent"])
      }, [
        createBaseVNode("div", _hoisted_1$6, [
          withDirectives(createBaseVNode("input", {
            "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => message.value = $event),
            class: "chats__input",
            type: "text"
          }, null, 512), [
            [
              vModelText,
              message.value,
              void 0,
              { trim: true }
            ]
          ]),
          _hoisted_2$5
        ])
      ], 32);
    };
  }
});
const ChatMessageForm_vue_vue_type_style_index_0_scoped_05389505_lang = "";
const ChatMessageForm = /* @__PURE__ */ _export_sfc(_sfc_main$6, [["__scopeId", "data-v-05389505"]]);
const _sfc_main$5 = {};
const _hoisted_1$5 = {
  xmlns: "http://www.w3.org/2000/svg",
  width: "16",
  height: "16",
  fill: "currentColor",
  class: "bi bi-chevron-left",
  viewBox: "0 0 16 16"
};
const _hoisted_2$4 = /* @__PURE__ */ createBaseVNode("path", {
  "fill-rule": "evenodd",
  d: "M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0"
}, null, -1);
const _hoisted_3$4 = [
  _hoisted_2$4
];
function _sfc_render(_ctx, _cache) {
  return openBlock(), createElementBlock("svg", _hoisted_1$5, _hoisted_3$4);
}
const ChevronLeft = /* @__PURE__ */ _export_sfc(_sfc_main$5, [["render", _sfc_render]]);
const { normalizeURL } = utils_exports;
const useChatsRelaysCache = defineStore("chatsRelaysCache", () => {
  const metas = ref({});
  const isLoadingRelays = ref(false);
  function addMetas(events) {
    events.forEach((event) => {
      const { pubkey, tags } = event;
      if (!metas.value.hasOwnProperty(pubkey)) {
        metas.value[pubkey] = { relays: /* @__PURE__ */ new Set(), cache_created: Date.now() };
      }
      tags.forEach((tag) => {
        if ((tag[0] === "r" || tag[0] === "relay") && tag[1] && tag[1].length) {
          const relayUrl = normalizeURL(tag[1]);
          metas.value[pubkey].relays.add(relayUrl);
        }
      });
    });
  }
  function getRelaysByPubkeys(pubkeys) {
    const relays = /* @__PURE__ */ new Set();
    pubkeys.forEach((pubkey) => {
      const cached = getMetaRelays(pubkey);
      cached.forEach((relay) => relays.add(relay));
    });
    return relays;
  }
  function hasMeta(pubkey) {
    return metas.value.hasOwnProperty(pubkey);
  }
  function getMetaRelays(pubkey) {
    return hasMeta(pubkey) ? metas.value[pubkey].relays : /* @__PURE__ */ new Set();
  }
  return { metas, hasMeta, getMetaRelays, addMetas, getRelaysByPubkeys, isLoadingRelays };
});
const _withScopeId$3 = (n) => (pushScopeId("data-v-e5e92b02"), n = n(), popScopeId(), n);
const _hoisted_1$4 = { class: "chat-header" };
const _hoisted_2$3 = /* @__PURE__ */ _withScopeId$3(() => /* @__PURE__ */ createBaseVNode("span", null, "Chats", -1));
const _hoisted_3$3 = { class: "chat-title" };
const _hoisted_4$3 = { class: "chats__chat-footer" };
const _sfc_main$4 = /* @__PURE__ */ defineComponent({
  __name: "ChatsConversation",
  props: {
    chat: {},
    userPubkey: {},
    showChatsList: { type: Boolean }
  },
  emits: ["setMessageStatusToPublished", "handleDeselectChat"],
  setup(__props, { emit: __emit }) {
    const emit2 = __emit;
    const chatStore = useChat();
    const chatsRelaysCacheStore = useChatsRelaysCache();
    const relayStore = useRelay();
    const poolStore = usePool();
    const pool = poolStore.pool;
    const messagesQueue = ref({});
    const loadingRoomRelaysQueue = ref({});
    const props = __props;
    const messagesContainer = ref(null);
    const roomTags = computed(
      () => {
        var _a, _b, _c;
        return ((_a = props == null ? void 0 : props.chat) == null ? void 0 : _a.messages.length) ? (_b = props.chat.messages[props.chat.messages.length - 1]) == null ? void 0 : _b.event.tags : ((_c = props == null ? void 0 : props.chat) == null ? void 0 : _c.initialRoomTags) ? props.chat.initialRoomTags : [];
      }
    );
    const roomPubkeys = computed(() => roomTags.value.length ? [...new Set(roomTags.value.map((t) => t[1]))] : []);
    const roomPubkeysWihoutUser = computed(() => roomPubkeys.value.filter((pubkey) => pubkey !== props.userPubkey));
    onUpdated(async () => {
      scrollChatToBottom();
      let pubkeysToDownload = [];
      roomPubkeysWihoutUser.value.forEach((pubkey) => {
        if (!chatsRelaysCacheStore.hasMeta(pubkey)) {
          pubkeysToDownload.push(pubkey);
        }
      });
      const { chat } = props;
      if (!pubkeysToDownload.length || loadingRoomRelaysQueue.value[chat.id]) {
        return;
      }
      loadingRoomRelaysQueue.value[chat.id] = true;
      const relays = relayStore.connectedUserReadWriteUrlsWithSelectedRelay;
      const metasDM = await pool.querySync(relays, { kinds: [EVENT_KIND.DM_RELAYS], authors: pubkeysToDownload });
      const loadedPubkeys = /* @__PURE__ */ new Set();
      metasDM.forEach((event) => {
        const hasRelay = event.tags.some((tag) => (tag[0] === "r" || tag[0] === "relay") && tag[1] && tag[1].length);
        if (hasRelay) {
          loadedPubkeys.add(event.pubkey);
        }
      });
      chatsRelaysCacheStore.addMetas(metasDM);
      pubkeysToDownload = pubkeysToDownload.filter((pubkey) => !loadedPubkeys.has(pubkey));
      if (pubkeysToDownload.length) {
        const metas = await pool.querySync(relays, { kinds: [EVENT_KIND.RELAY_LIST_META], authors: pubkeysToDownload });
        chatsRelaysCacheStore.addMetas(metas);
      }
      loadingRoomRelaysQueue.value[chat.id] = false;
      await nextTick();
      setTimeout(() => {
        var _a;
        if (!((_a = messagesQueue.value[chat.id]) == null ? void 0 : _a.length))
          return;
        const queue2 = [...messagesQueue.value[chat.id]].reverse();
        messagesQueue.value[chat.id] = [];
        queue2.forEach(async (q) => {
          await sendMessage(q.relays, q.wrapsBundle);
          emit2("setMessageStatusToPublished", chat.id, q.rumorId);
        });
      }, 1);
    });
    const scrollChatToBottom = async () => {
      await nextTick();
      const container = messagesContainer.value;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    };
    const preSendMessage = async (rumor, wrapsBundle) => {
      const { chat } = props;
      const message = {
        event: rumor,
        isPublished: false
      };
      chatStore.addOwnRumor(rumor.id);
      chat.messages.push(message);
      scrollChatToBottom();
      const relays = getMessagePublishRelays();
      if (loadingRoomRelaysQueue.value[chat.id]) {
        if (!messagesQueue.value[chat.id]) {
          messagesQueue.value[chat.id] = [];
        }
        messagesQueue.value[chat.id].push({
          rumorId: rumor.id,
          relays,
          wrapsBundle
        });
        return;
      }
      await sendMessage(relays, wrapsBundle);
      const msgIndex = chat.messages.findIndex((m) => m.event.id === rumor.id);
      chat.messages[msgIndex].isPublished = true;
    };
    const getMessagePublishRelays = () => {
      const ownRelays = relayStore.userChatRelaysUrls;
      const chatPartnersRelays = chatsRelaysCacheStore.getRelaysByPubkeys(roomPubkeysWihoutUser.value);
      return [.../* @__PURE__ */ new Set([...ownRelays, ...chatPartnersRelays])];
    };
    const sendMessage = async (relays, wrapsBundle) => {
      const promises = [];
      wrapsBundle.forEach((wrap) => {
        promises.push(...pool.publish(relays, wrap));
      });
      return await Promise.allSettled(promises);
    };
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        class: normalizeClass(["conversation", { "conversation_mobile-hidden": _ctx.showChatsList }])
      }, [
        createBaseVNode("div", _hoisted_1$4, [
          createBaseVNode("span", {
            onClick: _cache[0] || (_cache[0] = ($event) => emit2("handleDeselectChat")),
            class: "chats-link"
          }, [
            createVNode(ChevronLeft),
            _hoisted_2$3
          ]),
          createBaseVNode("span", _hoisted_3$3, toDisplayString(_ctx.chat ? _ctx.chat.title : "Select chat"), 1)
        ]),
        _ctx.chat ? (openBlock(), createElementBlock("div", {
          key: 0,
          class: "chats__messages",
          ref_key: "messagesContainer",
          ref: messagesContainer
        }, [
          createVNode(ChatMessagesList, {
            messages: _ctx.chat.messages,
            userPubkey: _ctx.userPubkey
          }, null, 8, ["messages", "userPubkey"])
        ], 512)) : createCommentVNode("", true),
        createBaseVNode("div", _hoisted_4$3, [
          createVNode(ChatMessageForm, {
            roomTags: roomTags.value,
            recipientsPubkeys: roomPubkeys.value,
            userPubkey: _ctx.userPubkey,
            onPreSendMessage: preSendMessage
          }, null, 8, ["roomTags", "recipientsPubkeys", "userPubkey"])
        ])
      ], 2);
    };
  }
});
const ChatsConversation_vue_vue_type_style_index_0_scoped_e5e92b02_lang = "";
const ChatsConversation = /* @__PURE__ */ _export_sfc(_sfc_main$4, [["__scopeId", "data-v-e5e92b02"]]);
const _withScopeId$2 = (n) => (pushScopeId("data-v-94c27758"), n = n(), popScopeId(), n);
const _hoisted_1$3 = /* @__PURE__ */ _withScopeId$2(() => /* @__PURE__ */ createBaseVNode("label", { for: "start-chat-pubkey" }, [
  /* @__PURE__ */ createBaseVNode("strong", null, "Profile's public key")
], -1));
const _hoisted_2$2 = { class: "user-field" };
const _hoisted_3$2 = /* @__PURE__ */ _withScopeId$2(() => /* @__PURE__ */ createBaseVNode("button", {
  type: "submit",
  class: "start-chat-btn"
}, "Start chat", -1));
const _hoisted_4$2 = {
  key: 0,
  class: "notice"
};
const _hoisted_5$2 = {
  key: 1,
  class: "error"
};
const _sfc_main$3 = /* @__PURE__ */ defineComponent({
  __name: "ChatCreateRoomForm",
  props: {
    isLoadingProfile: { type: Boolean }
  },
  emits: ["startChat"],
  setup(__props, { emit: __emit }) {
    const emit2 = __emit;
    const relayStore = useRelay();
    const userSearchQuery = ref("");
    const pubkeyError = ref("");
    const startChat = () => {
      const search = userSearchQuery.value;
      let pubkey = "";
      if (!relayStore.isConnectedToReadWriteRelays) {
        pubkeyError.value = "Please connect to a relay first.";
        return;
      }
      if (!search.length) {
        pubkeyError.value = "Provide the public key of the person to chat with.";
        return;
      }
      if (isSHA256Hex(search)) {
        pubkey = search;
      } else {
        try {
          let { data, type } = nip19_exports.decode(search);
          if (type !== "npub") {
            pubkeyError.value = "Public key is invalid. Please check it and try again.";
            return;
          }
          pubkey = data.toString();
        } catch (e) {
          pubkeyError.value = "Public key is invalid. Please check it and try again.";
          return;
        }
      }
      pubkeyError.value = "";
      emit2("startChat", pubkey);
    };
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock(Fragment, null, [
        createBaseVNode("form", {
          onSubmit: withModifiers(startChat, ["prevent"])
        }, [
          _hoisted_1$3,
          createBaseVNode("div", _hoisted_2$2, [
            withDirectives(createBaseVNode("input", {
              "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => userSearchQuery.value = $event),
              class: "find-user-input",
              id: "start-chat-pubkey",
              type: "text",
              placeholder: "npub or hex of pubkey"
            }, null, 512), [
              [
                vModelText,
                userSearchQuery.value,
                void 0,
                { trim: true }
              ]
            ]),
            _hoisted_3$2
          ])
        ], 32),
        _ctx.isLoadingProfile ? (openBlock(), createElementBlock("div", _hoisted_4$2, " Loading profile info... ")) : createCommentVNode("", true),
        pubkeyError.value ? (openBlock(), createElementBlock("div", _hoisted_5$2, toDisplayString(pubkeyError.value), 1)) : createCommentVNode("", true)
      ], 64);
    };
  }
});
const ChatCreateRoomForm_vue_vue_type_style_index_0_scoped_94c27758_lang = "";
const ChatCreateRoomForm = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["__scopeId", "data-v-94c27758"]]);
const _withScopeId$1 = (n) => (pushScopeId("data-v-3771f7a9"), n = n(), popScopeId(), n);
const _hoisted_1$2 = /* @__PURE__ */ _withScopeId$1(() => /* @__PURE__ */ createBaseVNode("div", { class: "chats-desc" }, [
  /* @__PURE__ */ createBaseVNode("p", null, [
    /* @__PURE__ */ createTextVNode(" Chats use the new Nostr "),
    /* @__PURE__ */ createBaseVNode("a", {
      target: "_blank",
      href: "https://github.com/nostr-protocol/nips/blob/master/44.md"
    }, "NIP-44"),
    /* @__PURE__ */ createTextVNode(" encryption standard. Make sure the person you are chatting with uses a Nostr client that supports this NIP. ")
  ])
], -1));
const _hoisted_2$1 = { class: "user-field-wrapper" };
const _hoisted_3$1 = /* @__PURE__ */ _withScopeId$1(() => /* @__PURE__ */ createBaseVNode("h3", { class: "chats-title" }, " Chats ", -1));
const _hoisted_4$1 = {
  key: 0,
  class: "no-chats"
};
const _hoisted_5$1 = { key: 1 };
const _hoisted_6$1 = {
  key: 2,
  class: "chats"
};
const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: "Chat",
  setup(__props) {
    const { normalizeURL: normalizeURL2 } = utils_exports;
    let chatSub;
    const relayStore = useRelay();
    const nsecStore = useNsec();
    const chatStore = useChat();
    const poolStore = usePool();
    const pool = poolStore.pool;
    const currentChatId = ref("");
    const isLoadingNewChatProfile = ref(false);
    const userChats = ref({});
    const userChatsMessagesCache = ref({});
    const userPubkey = ref("");
    const isChatsLoading = ref(false);
    const chatsEmpty = computed(() => Object.keys(userChats.value).length === 0);
    const isConnectedLoggedInUser = computed(() => relayStore.isConnectedToReadWriteRelays && nsecStore.isNsecValidTemp);
    const sortedChats = computed(() => {
      return Object.entries(userChats.value).map(([key, value]) => value).sort((a, b) => b.created_at_last_message - a.created_at_last_message);
    });
    const showChatsList = ref(true);
    watch(
      () => nsecStore.nsec,
      async () => {
        if (!nsecStore.isNsecValidTemp)
          return;
        userPubkey.value = nsecStore.getPubkey();
      },
      { immediate: true }
    );
    watch(
      () => relayStore.isConnectingToReadWriteRelays,
      (value) => {
        if (value) {
          isChatsLoading.value = true;
        }
      }
    );
    watch(
      () => relayStore.isConnectedToReadWriteRelays,
      (value) => {
        if (value && nsecStore.isNsecValidTemp) {
          loadChats();
        }
      }
    );
    onMounted(() => {
      if (isConnectedLoggedInUser.value) {
        loadChats();
      }
    });
    const addChat = (chat) => {
      userChats.value[chat.id] = chat;
      setTimeout(() => {
        if (userChatsMessagesCache.value[chat.id]) {
          const messages = [...userChatsMessagesCache.value[chat.id]];
          userChatsMessagesCache.value[chat.id] = [];
          messages.forEach((message) => {
            userChats.value[chat.id].messages.push(message);
          });
        }
      }, 1);
      isChatsLoading.value = false;
    };
    const handleChatTitleError = (error) => {
      console.error("Chats error:", error);
    };
    const loadChats = async () => {
      isChatsLoading.value = true;
      let relays = relayStore.connectedUserReadWriteUrlsWithSelectedRelay;
      const hostPubkey = nsecStore.getPubkey();
      userChats.value = {};
      chatSub == null ? void 0 : chatSub.close();
      const dmRelaysEvents = await pool.querySync(relays, { kinds: [EVENT_KIND.DM_RELAYS], authors: [hostPubkey] });
      if (dmRelaysEvents.length) {
        const dmRelaysUrlsSet = /* @__PURE__ */ new Set();
        dmRelaysEvents.forEach((event) => {
          event.tags.forEach((tag) => {
            if ((tag[0] === "r" || tag[0] === "relay") && tag[1] && tag[1].length) {
              dmRelaysUrlsSet.add(normalizeURL2(tag[1]));
            }
          });
        });
        if (dmRelaysUrlsSet.size) {
          relays = [...dmRelaysUrlsSet];
          relayStore.setUserDMRelaysUrls(relays);
        }
      }
      const hostMessages = await pool.querySync(relays, { kinds: [EVENT_KIND.GIFT_WRAP], "#p": [hostPubkey] });
      const privateKey = nsecStore.getPrivkeyBytes();
      let chats = {};
      let lastMessageDate = 0;
      const initialMessagesIds = /* @__PURE__ */ new Set();
      hostMessages.forEach((giftWrap) => {
        initialMessagesIds.add(giftWrap.id);
        const rumor = getRumorFromWrap(giftWrap, privateKey);
        if (!rumor)
          return;
        if (isGroupChat(rumor))
          return;
        const chatId = getChatRoomHash(rumor);
        const message = getChatMessageFromRumor(rumor);
        if (chats[chatId]) {
          chats[chatId].messages.push(message);
        } else {
          chats[chatId] = {
            "messages": [message]
          };
        }
        if (rumor.created_at > lastMessageDate) {
          lastMessageDate = rumor.created_at;
        }
      });
      const chatsPromises = [];
      for (const id in chats) {
        const chat = chats[id];
        chat.id = id;
        chat.messages = chat.messages.sort((a, b) => a.event.created_at - b.event.created_at);
        chat.created_at_last_message = chat.messages[chat.messages.length - 1].event.created_at;
        const chatPromise = injectChatTitle(chat, hostPubkey, pool, relayStore.connectedUserReadWriteUrlsWithSelectedRelay);
        chatsPromises.push(chatPromise);
      }
      if (chatsPromises.length) {
        racePromises(chatsPromises, addChat, handleChatTitleError);
      } else {
        isChatsLoading.value = false;
      }
      const lastGiftWrapDate = hostMessages.length ? lastMessageDate - TWO_DAYS : null;
      subscribeToMessages(relays, lastGiftWrapDate, initialMessagesIds);
    };
    const subscribeToMessages = (relays, since = null, eventsToSkip = null) => {
      const hostPubkey = nsecStore.getPubkey();
      const privateKey = nsecStore.getPrivkeyBytes();
      const filter = { kinds: [EVENT_KIND.GIFT_WRAP], "#p": [hostPubkey] };
      if (since) {
        filter.since = since;
      }
      chatSub = pool.subscribeMany(
        relays,
        [filter],
        {
          onevent(giftWrap) {
            if (eventsToSkip && eventsToSkip.has(giftWrap.id))
              return;
            const rumor = getRumorFromWrap(giftWrap, privateKey);
            if (!rumor)
              return;
            if (isGroupChat(rumor))
              return;
            const chatId = getChatRoomHash(rumor);
            const message = getChatMessageFromRumor(rumor);
            if (userChats.value[chatId]) {
              if (chatStore.ownRumors.has(message.event.id))
                return;
              userChats.value[chatId].messages.push(message);
            } else {
              if (!userChatsMessagesCache.value[chatId]) {
                userChatsMessagesCache.value[chatId] = [];
              }
              userChatsMessagesCache.value[chatId].push(message);
            }
          }
        }
      );
    };
    const handleSelectChat = (chatId) => {
      currentChatId.value = chatId;
      showChatsList.value = false;
    };
    const handleDeselectChat = () => {
      currentChatId.value = "";
      showChatsList.value = true;
    };
    const setMessageStatusToPublished = (chatId, rumorId) => {
      const message = userChats.value[chatId].messages.find((m) => m.event.id === rumorId);
      if (message) {
        message.isPublished = true;
      }
    };
    const startChat = async (pubkey) => {
      const roomPubkeys = pubkey === userPubkey.value ? [pubkey] : [userPubkey.value, pubkey];
      const chatId = getNewChatRoomHash(roomPubkeys);
      if (userChats.value[chatId]) {
        return handleSelectChat(chatId);
      }
      isLoadingNewChatProfile.value = true;
      const title = await getNewChatTitle(pubkey, pool, relayStore.connectedUserReadWriteUrlsWithSelectedRelay);
      isLoadingNewChatProfile.value = false;
      const newChat = {
        id: chatId,
        messages: [],
        title,
        initialRoomTags: roomPubkeys.map((p2) => ["p", p2]),
        created_at_last_message: now()
      };
      addChat(newChat);
      await nextTick();
      handleSelectChat(chatId);
    };
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock(Fragment, null, [
        _hoisted_1$2,
        createBaseVNode("div", _hoisted_2$1, [
          createVNode(ChatCreateRoomForm, {
            onStartChat: startChat,
            isLoadingProfile: isLoadingNewChatProfile.value
          }, null, 8, ["isLoadingProfile"])
        ]),
        _hoisted_3$1,
        !isConnectedLoggedInUser.value && !isChatsLoading.value ? (openBlock(), createElementBlock("div", _hoisted_4$1, " Please connect and login to see you chats. ")) : createCommentVNode("", true),
        isChatsLoading.value ? (openBlock(), createElementBlock("div", _hoisted_5$1, " Loading chats... ")) : createCommentVNode("", true),
        isConnectedLoggedInUser.value && !isChatsLoading.value ? (openBlock(), createElementBlock("div", _hoisted_6$1, [
          createVNode(ChatsList, {
            chats: sortedChats.value,
            currentChatId: currentChatId.value,
            handleSelectChat,
            showChatsList: showChatsList.value
          }, null, 8, ["chats", "currentChatId", "showChatsList"]),
          !chatsEmpty.value ? (openBlock(), createBlock(ChatsConversation, {
            key: 0,
            onSetMessageStatusToPublished: setMessageStatusToPublished,
            onHandleDeselectChat: handleDeselectChat,
            chat: userChats.value[currentChatId.value],
            userPubkey: userPubkey.value,
            showChatsList: showChatsList.value
          }, null, 8, ["chat", "userPubkey", "showChatsList"])) : createCommentVNode("", true)
        ])) : createCommentVNode("", true)
      ], 64);
    };
  }
});
const Chat_vue_vue_type_style_index_0_scoped_3771f7a9_lang = "";
const Chat = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["__scopeId", "data-v-3771f7a9"]]);
const routes = [
  {
    path: "/feed",
    name: "Feed",
    components: {
      default: Feed,
      messageInput: MessageInput
    }
  },
  {
    path: "/message",
    name: "Message",
    components: {
      default: Feed,
      signedEventInput: SignedEventInput
    }
  },
  {
    path: "/chat",
    name: "Chat",
    component: Chat
  },
  {
    path: "/log",
    name: "Log",
    components: {
      default: Feed,
      messageInput: MessageInput
    }
  },
  {
    path: "/user",
    name: "User",
    component: User,
    alias: ["/event"]
  },
  {
    path: "/user/:id",
    component: User,
    alias: ["/event/:id"]
  },
  {
    path: "/help",
    name: "Help",
    component: _sfc_main$f
  },
  {
    path: "/",
    component: _sfc_main$f,
    beforeEnter: (to, from, next) => {
      const userId = to.query.user;
      const eventId = to.query.event;
      if (userId == null ? void 0 : userId.length) {
        next({ path: `/user/${userId}` });
      } else if (eventId == null ? void 0 : eventId.length) {
        next({ path: `/event/${eventId}` });
      } else {
        next();
      }
    }
  },
  {
    path: "/settings",
    component: Settings
  }
];
const router = createRouter({
  history: createWebHashHistory(),
  // @ts-ignore 
  routes
});
const _withScopeId = (n) => (pushScopeId("data-v-d1398494"), n = n(), popScopeId(), n);
const _hoisted_1$1 = { class: "relay-fields" };
const _hoisted_2 = { class: "relay-fields__wrapper" };
const _hoisted_3 = { class: "relay-fields__relay" };
const _hoisted_4 = { class: "relay-fields__select-field" };
const _hoisted_5 = /* @__PURE__ */ _withScopeId(() => /* @__PURE__ */ createBaseVNode("label", {
  class: "field-label_priv-key",
  for: "relays"
}, [
  /* @__PURE__ */ createBaseVNode("strong", null, "Select relay")
], -1));
const _hoisted_6 = { class: "field-elements" };
const _hoisted_7 = ["value"];
const _hoisted_8 = /* @__PURE__ */ _withScopeId(() => /* @__PURE__ */ createBaseVNode("option", { value: "custom" }, "custom url", -1));
const _hoisted_9 = { class: "message-fields__field" };
const _hoisted_10 = /* @__PURE__ */ _withScopeId(() => /* @__PURE__ */ createBaseVNode("label", { for: "priv_key" }, [
  /* @__PURE__ */ createBaseVNode("strong", null, "Private key (optional)")
], -1));
const _hoisted_11 = { class: "field-elements" };
const _hoisted_12 = { class: "remember-me" };
const _hoisted_13 = /* @__PURE__ */ _withScopeId(() => /* @__PURE__ */ createBaseVNode("label", {
  class: "remember-me__label",
  for: "remember-me"
}, " Remember me", -1));
const _hoisted_14 = { class: "error" };
const _hoisted_15 = {
  key: 0,
  class: "field"
};
const _hoisted_16 = /* @__PURE__ */ _withScopeId(() => /* @__PURE__ */ createBaseVNode("label", { for: "relay_url" }, [
  /* @__PURE__ */ createBaseVNode("strong", null, "Relay URL")
], -1));
const _hoisted_17 = { class: "field-elements" };
const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "HeaderFields",
  props: {
    wsError: {}
  },
  emits: ["relayConnect", "relayDisconnect"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit2 = __emit;
    const relayStore = useRelay();
    const feedStore = useFeed();
    const nsecStore = useNsec();
    const isLoggedIn = ref(false);
    const showCustomRelayUrl = ref(false);
    const showConnectBtn = computed(() => {
      if (!relayStore.currentRelay.connected)
        return true;
      return relayStore.selectInputRelayUrl !== relayStore.currentRelay.url;
    });
    relayStore.setSelectedRelay(DEFAULT_RELAYS[0]);
    const handleRelaySelect = (event) => {
      const value = event.target.value;
      showCustomRelayUrl.value = value === "custom";
      relayStore.setSelectedRelay(value);
    };
    onMounted(() => {
      if (nsecStore.isValidNsecPresented()) {
        isLoggedIn.value = true;
      }
    });
    const handleNsecInput = (event) => {
      if (!nsecStore.isNsecValid()) {
        isLoggedIn.value = false;
        return;
      }
      isLoggedIn.value = true;
      if (nsecStore.rememberMe) {
        localStorage.setItem("privkey", nsecStore.nsec);
      }
      if (relayStore.isConnectedToRelay && (nsecStore.cachedNsec !== nsecStore.nsec || feedStore.selectedFeedSource === "follows")) {
        emit2("relayConnect");
      }
    };
    const handleGenerateRandomPrivKey = () => {
      const privKeyHex = generateSecretKey();
      nsecStore.updateNsec(nip19_exports.nsecEncode(privKeyHex));
      isLoggedIn.value = true;
    };
    const handleLogout = () => {
      nsecStore.updateNsec("");
      localStorage.removeItem("privkey");
      isLoggedIn.value = false;
      if (!relayStore.isConnectedToRelay)
        return;
      if (!relayStore.userReadWriteRelays.length)
        return;
      feedStore.setSelectedFeedSource("network");
      emit2("relayDisconnect");
      emit2("relayConnect");
    };
    const handleRememberMe = () => {
      if (nsecStore.rememberMe) {
        localStorage.setItem("rememberMe", "true");
        localStorage.setItem("privkey", nsecStore.nsec);
      } else {
        localStorage.clear();
      }
    };
    const handleRelayConnect = () => {
      emit2("relayConnect");
    };
    const handleRelayDisconnect = () => {
      emit2("relayDisconnect");
    };
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock(Fragment, null, [
        createBaseVNode("p", _hoisted_1$1, [
          createBaseVNode("div", _hoisted_2, [
            createBaseVNode("div", _hoisted_3, [
              createBaseVNode("div", _hoisted_4, [
                _hoisted_5,
                createBaseVNode("div", _hoisted_6, [
                  createBaseVNode("select", {
                    class: "select-relay__select",
                    onChange: handleRelaySelect,
                    name: "relays",
                    id: "relays"
                  }, [
                    (openBlock(true), createElementBlock(Fragment, null, renderList(unref(DEFAULT_RELAYS), (url) => {
                      return openBlock(), createElementBlock("option", { value: url }, toDisplayString(url), 9, _hoisted_7);
                    }), 256)),
                    _hoisted_8
                  ], 32),
                  showConnectBtn.value ? (openBlock(), createElementBlock("button", {
                    key: 0,
                    onClick: handleRelayConnect,
                    class: "select-relay__btn"
                  }, toDisplayString(unref(relayStore).isConnectingToRelay ? "Connecting..." : "Connect"), 1)) : (openBlock(), createElementBlock("button", {
                    key: 1,
                    onClick: handleRelayDisconnect,
                    class: "select-relay__btn"
                  }, " Disconnect "))
                ])
              ])
            ]),
            createBaseVNode("div", _hoisted_9, [
              _hoisted_10,
              createBaseVNode("div", _hoisted_11, [
                withDirectives(createBaseVNode("input", {
                  onInput: handleNsecInput,
                  "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => unref(nsecStore).nsec = $event),
                  class: "priv-key-input",
                  id: "priv_key",
                  type: "password",
                  placeholder: "nsec..."
                }, null, 544), [
                  [vModelText, unref(nsecStore).nsec]
                ]),
                !isLoggedIn.value ? (openBlock(), createElementBlock("button", {
                  key: 0,
                  onClick: handleGenerateRandomPrivKey,
                  class: "random-key-btn"
                }, "Random")) : createCommentVNode("", true),
                isLoggedIn.value ? (openBlock(), createElementBlock("button", {
                  key: 1,
                  onClick: handleLogout,
                  class: "random-key-btn"
                }, "Logout")) : createCommentVNode("", true)
              ]),
              createBaseVNode("div", _hoisted_12, [
                withDirectives(createBaseVNode("input", {
                  onChange: handleRememberMe,
                  class: "remember-me__input",
                  type: "checkbox",
                  id: "remember-me",
                  "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => unref(nsecStore).rememberMe = $event)
                }, null, 544), [
                  [vModelCheckbox, unref(nsecStore).rememberMe]
                ]),
                _hoisted_13
              ])
            ])
          ]),
          createBaseVNode("div", _hoisted_14, toDisplayString(props.wsError), 1)
        ]),
        showCustomRelayUrl.value ? (openBlock(), createElementBlock("div", _hoisted_15, [
          _hoisted_16,
          createBaseVNode("div", _hoisted_17, [
            withDirectives(createBaseVNode("input", {
              "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => unref(relayStore).selectInputCustomRelayUrl = $event),
              class: "relay-input",
              id: "relay_url",
              type: "text",
              placeholder: "[wss://]relay.example.com"
            }, null, 512), [
              [vModelText, unref(relayStore).selectInputCustomRelayUrl]
            ])
          ])
        ])) : createCommentVNode("", true)
      ], 64);
    };
  }
});
const HeaderFields_vue_vue_type_style_index_0_scoped_d1398494_lang = "";
const HeaderFields = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-d1398494"]]);
const _hoisted_1 = { class: "tabs" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "App",
  setup(__props) {
    const router2 = useRouter();
    const route = useRoute();
    const npubStore = useNpub();
    const nsecStore = useNsec();
    const relayStore = useRelay();
    const feedStore = useFeed();
    const poolStore = usePool();
    const pool = poolStore.pool;
    let relaysSub;
    let curInterval;
    const isRemembered = localStorage.getItem("rememberMe") === "true";
    nsecStore.setRememberMe(isRemembered);
    const initialNsec = isRemembered ? localStorage.getItem("privkey") : "";
    nsecStore.updateNsec(initialNsec || "");
    const eventsIds = /* @__PURE__ */ new Set();
    const sentEventIds = /* @__PURE__ */ new Set();
    let newEvents = ref([]);
    let newEventsBadgeCount = ref(0);
    let newAuthorImg1 = ref("");
    let newAuthorImg2 = ref("");
    const eventsLog = ref([]);
    const wsError = ref("");
    const jsonErr = ref("");
    const broadcastNotice = ref("");
    const isSendingMessage = ref(false);
    const userTabLink = computed(() => npubStore.cachedUrlNpub.length ? `/user/${npubStore.cachedUrlNpub}` : "/user");
    const logHtmlParts = (parts) => {
      eventsLog.value.unshift(parts);
    };
    const updateNewEventsElement = async () => {
      var _a, _b;
      const relays = relayStore.connectedFeedRelaysUrls;
      if (!relays.length)
        return;
      const eventsToShow = feedStore.newEventsToShow;
      if (eventsToShow.length < 2)
        return;
      const pub1 = eventsToShow[eventsToShow.length - 1].pubkey;
      const pub2 = eventsToShow[eventsToShow.length - 2].pubkey;
      const eventsListOptions1 = { kinds: [0], authors: [pub1], limit: 1 };
      const eventsListOptions2 = { kinds: [0], authors: [pub2], limit: 1 };
      const author1 = await pool.querySync(relays, eventsListOptions1);
      const author2 = await pool.querySync(relays, eventsListOptions2);
      if (!curInterval)
        return;
      if (!((_a = author1[0]) == null ? void 0 : _a.content) || !((_b = author2[0]) == null ? void 0 : _b.content))
        return;
      newAuthorImg1.value = JSON.parse(author1[0].content).picture;
      newAuthorImg2.value = JSON.parse(author2[0].content).picture;
      feedStore.setNewEventsBadgeImageUrls([newAuthorImg1.value, newAuthorImg2.value]);
      newEventsBadgeCount.value = eventsToShow.length;
      feedStore.setNewEventsBadgeCount(eventsToShow.length);
      feedStore.setShowNewEventsBadge(true);
    };
    const timeout = (ms) => {
      return new Promise((resolve2) => setTimeout(resolve2, ms));
    };
    const listRootEvents = (pool2, relays, filters) => {
      return new Promise((resolve2) => {
        const events = [];
        let filtersLimit;
        let newFilters = filters;
        if (filters && filters.length && filters[0].limit) {
          let { limit, ...restFilters } = filters[0];
          newFilters = [restFilters];
          filtersLimit = limit;
        }
        let subClosed = false;
        const sub = pool2.subscribeMany(
          relays,
          newFilters,
          {
            onevent(event) {
              if (subClosed)
                return;
              const nip10Data = nip10_exports.parse(event);
              if (nip10Data.reply || nip10Data.root)
                return;
              events.push(event);
              if (filtersLimit && events.length >= filtersLimit) {
                sub.close();
                subClosed = true;
                resolve2(events.slice(0, filtersLimit));
              }
            },
            oneose() {
              sub.close();
              const result = filtersLimit ? events.slice(0, filtersLimit) : events;
              resolve2(result);
            }
          }
        );
      });
    };
    async function handleRelayConnect(useProvidedRelaysList = false, changeFeedSource = false) {
      var _a, _b;
      if (relayStore.isConnectingToRelay)
        return;
      let relayUrl = relayStore.selectInputRelayUrl;
      if (relayUrl === "custom") {
        const customUrl = relayStore.selectInputCustomRelayUrl;
        relayUrl = customUrl.length ? utils_exports.normalizeURL(customUrl) : "";
      }
      if (!relayUrl.length)
        return;
      if (nsecStore.isNotValidNsecPresented()) {
        wsError.value = "Private key is invalid. Please check it and try again.";
        return;
      } else {
        nsecStore.updateCachedNsec(nsecStore.nsec);
      }
      if (!useProvidedRelaysList && relayStore.currentRelay.connected) {
        relayStore.currentRelay.close();
        logHtmlParts([
          { type: "text", value: "disconnected from " },
          { type: "bold", value: relayStore.currentRelay.url }
        ]);
      }
      if (relaysSub) {
        relaysSub.close();
      }
      if (curInterval) {
        clearInterval(curInterval);
        curInterval = 0;
      }
      if (!useProvidedRelaysList) {
        relayStore.setReedRelays([]);
        relayStore.setWriteRelays([]);
      }
      let relay;
      relayStore.setIsConnectingToReadWriteRelaysStatus(true);
      relayStore.setIsConnectedToReadWriteRelaysStatus(false);
      if (!useProvidedRelaysList) {
        try {
          relayStore.setConnectionToRelayStatus(true);
          feedStore.setLoadingFeedSourceStatus(true);
          try {
            relay = await Relay.connect(relayUrl);
          } catch (e) {
            await timeout(500);
            relay = await Relay.connect(relayUrl);
          }
          wsError.value = "";
        } catch (e) {
          let error = `WebSocket connection to "${relayUrl}" failed. You can try again. `;
          if (!navigator.onLine) {
            error += `Or check your internet connection.`;
          } else {
            error += `Also check WebSocket address. Relay address should be a correct WebSocket URL. Or relay is unavailable or you are offline.`;
          }
          wsError.value = error;
          relayStore.setConnectionToRelayStatus(false);
          return;
        }
        relayStore.updateCurrentRelay(relay);
        logHtmlParts([
          { type: "text", value: "connected to " },
          { type: "bold", value: relay.url }
        ]);
        if (nsecStore.isNotValidNsecPresented()) {
          wsError.value = "Private key is invalid. Please check it and try again.";
        }
        if (nsecStore.isValidNsecPresented()) {
          const pubkey2 = nsecStore.getPubkey();
          const timeout2 = 3e3;
          const authorMeta = await relayGet(relay, [{ kinds: [10002], limit: 1, authors: [pubkey2] }], timeout2);
          if (authorMeta && authorMeta.tags.length) {
            const { read, write } = parseRelaysNip65(authorMeta);
            relayStore.setReedRelays(read);
            relayStore.setWriteRelays(write);
          }
        }
      }
      feedStore.setShowNewEventsBadge(false);
      newEvents.value = [];
      feedStore.updateNewEventsToShow([]);
      if (changeFeedSource || useProvidedRelaysList) {
        feedStore.setLoadingFeedSourceStatus(true);
      }
      const userConnectedReadRelays = [];
      const userConnectedWriteRelays = [];
      if (relayStore.userReadWriteRelays.length) {
        const result = await Promise.all(
          relayStore.userReadWriteRelays.map(async (relay2) => {
            const isConnected = await isWsAvailable(relay2.url);
            return { url: relay2.url, connected: isConnected, type: relay2.type };
          })
        );
        result.forEach((r) => {
          if (useProvidedRelaysList && !relayStore.reedRelays.includes(r.url)) {
            return;
          }
          if (r.connected) {
            userConnectedReadRelays.push(r.url);
            if (r.type === "write") {
              userConnectedWriteRelays.push(r.url);
            }
          }
          if ((relay == null ? void 0 : relay.url) === r.url)
            return;
          const mesasge = r.connected ? "connected to " : "failed to connect to ";
          logHtmlParts([
            { type: "text", value: mesasge },
            { type: "bold", value: r.url }
          ]);
        });
      }
      relayStore.setConnectedUserReadRelayUrls(userConnectedReadRelays);
      relayStore.setConnectedUserWriteRelayUrls(userConnectedWriteRelays);
      relayStore.setIsConnectingToReadWriteRelaysStatus(false);
      relayStore.setIsConnectedToReadWriteRelaysStatus(true);
      let feedRelays = userConnectedReadRelays.length ? userConnectedReadRelays : [relayUrl];
      const pubkey = nsecStore.getPubkey();
      const followsRelaysMap = {};
      let followsPubkeys = [];
      if (feedStore.isFollowsSource && nsecStore.isValidNsecPresented()) {
        const follows = await pool.get(feedRelays, { kinds: [3], limit: 1, authors: [pubkey] });
        if (follows && follows.tags.length) {
          followsPubkeys = follows.tags.map((f) => f[1]);
          const followsMeta = await pool.querySync(feedRelays, { kinds: [10002], authors: followsPubkeys });
          const followsRelaysUrlsExceptUserRelays = /* @__PURE__ */ new Set();
          followsMeta.forEach((event) => {
            event.tags.forEach((tag) => {
              if (tag[0] !== "r")
                return;
              const relayUrl2 = utils_exports.normalizeURL(tag[1]);
              if (feedRelays.includes(relayUrl2))
                return;
              followsRelaysUrlsExceptUserRelays.add(relayUrl2);
            });
          });
          const followsSortedRelays = await Promise.all(
            Array.from(followsRelaysUrlsExceptUserRelays).map(async (relay2) => {
              const isConnected = await isWsAvailable(relay2, 1e3);
              return { url: relay2, connected: isConnected };
            })
          );
          const isSuccess = followsSortedRelays.some((r) => r.connected);
          if (isSuccess) {
            logHtmlParts([
              { type: "text", value: "Connected to follows relays" }
            ]);
          } else {
            logHtmlParts([
              { type: "text", value: "Failed to connect to follows relays" }
            ]);
          }
          const followsConnectedRelaysUrls = followsSortedRelays.filter((r) => r.connected).map((r) => r.url);
          followsMeta.forEach((event) => {
            const normalizedUrls = [];
            event.tags.forEach((tag) => {
              if (tag[0] !== "r")
                return;
              const relayUrl2 = utils_exports.normalizeURL(tag[1]);
              if (followsConnectedRelaysUrls.includes(relayUrl2) || feedRelays.includes(relayUrl2)) {
                normalizedUrls.push(relayUrl2);
              }
            });
            followsRelaysMap[event.pubkey] = normalizedUrls;
          });
          feedRelays = [.../* @__PURE__ */ new Set([...feedRelays, ...followsConnectedRelaysUrls])];
        }
      }
      let postsFilter = { kinds: [1], limit: DEFAULT_EVENTS_COUNT };
      followsPubkeys = followsPubkeys.filter((f) => f !== pubkey);
      if (followsPubkeys.length) {
        postsFilter.authors = followsPubkeys;
      }
      relayStore.setConnectedFeedRelayUrls(feedRelays);
      const postsEvents = await listRootEvents(pool, feedRelays, [postsFilter]);
      const posts = postsEvents.sort((a, b) => b.created_at - a.created_at);
      const postPromises = [];
      const cachedMetasPubkeys = [];
      const cachedMetas = {};
      for (const post of posts) {
        const author = post.pubkey;
        const relays = feedStore.isFollowsSource && ((_a = followsRelaysMap[author]) == null ? void 0 : _a.length) ? followsRelaysMap[author] : feedRelays;
        let usePurple = feedStore.isFollowsSource && ((_b = followsRelaysMap[author]) == null ? void 0 : _b.length) && relays.includes(PURPLEPAG_RELAY_URL);
        let metasPromise = null;
        let metaAuthorPromise = null;
        const allPubkeysToGet = getNoteReferences(post);
        if (!usePurple && !allPubkeysToGet.includes(author)) {
          allPubkeysToGet.push(author);
        }
        if (usePurple && !cachedMetasPubkeys.includes(author)) {
          cachedMetasPubkeys.push(author);
          metaAuthorPromise = pool.get([PURPLEPAG_RELAY_URL], { kinds: [0], authors: [author] });
        }
        const pubkeysForRequest = [];
        allPubkeysToGet.forEach((pubkey2) => {
          if (!cachedMetasPubkeys.includes(pubkey2)) {
            cachedMetasPubkeys.push(pubkey2);
            pubkeysForRequest.push(pubkey2);
          }
        });
        if (pubkeysForRequest.length) {
          metasPromise = pool.querySync(relays, { kinds: [0], authors: pubkeysForRequest });
        }
        const likesRepostsRepliesPromise = pool.querySync(relays, { kinds: [1, 6, 7], "#e": [post.id] });
        const postPromise = Promise.all([post, metasPromise, likesRepostsRepliesPromise, metaAuthorPromise]);
        postPromises.push(postPromise);
      }
      eventsIds.clear();
      feedStore.updatePaginationEventsIds([]);
      feedStore.updateEvents([]);
      for (const promise of postPromises) {
        const result = await promise;
        const post = result[0];
        const metas = result[1] || [];
        const likesRepostsReplies = result[2] || [];
        let authorMeta = result[3];
        const referencesMetas = [];
        const refsPubkeys = [];
        if (authorMeta) {
          cachedMetas[authorMeta.pubkey] = authorMeta;
          referencesMetas.push(authorMeta);
          refsPubkeys.push(authorMeta.pubkey);
        }
        const filteredMetas = filterMetas(metas);
        filteredMetas.forEach((meta) => {
          const ref2 = meta;
          cachedMetas[meta.pubkey] = meta;
          referencesMetas.push(ref2);
          refsPubkeys.push(ref2.pubkey);
          if (meta.pubkey === post.pubkey) {
            authorMeta = meta;
          }
        });
        cachedMetasPubkeys.forEach((pubkey2) => {
          if (refsPubkeys.includes(pubkey2))
            return;
          if (!cachedMetas.hasOwnProperty(pubkey2)) {
            cachedMetas[pubkey2] = null;
          }
          const ref2 = cachedMetas[pubkey2];
          referencesMetas.push(ref2);
          if (pubkey2 === post.pubkey) {
            authorMeta = ref2;
          }
        });
        injectReferencesToNote(post, referencesMetas);
        injectAuthorsToNotes([post], [authorMeta]);
        injectRootLikesRepostsRepliesCount(post, likesRepostsReplies);
        feedStore.pushToEvents(post);
        if (feedStore.isLoadingFeedSource) {
          feedStore.setLoadingFeedSourceStatus(false);
          feedStore.setLoadingMoreStatus(true);
        }
      }
      feedStore.setLoadingMoreStatus(false);
      posts.forEach((e) => {
        eventsIds.add(e.id);
        feedStore.pushToPaginationEventsIds(e.id);
      });
      relayStore.setConnectionToRelayStatus(false);
      let subscribePostsFilter = { kinds: [1], limit: 1 };
      if (followsPubkeys.length) {
        subscribePostsFilter.authors = followsPubkeys;
      }
      relaysSub = pool.subscribeMany(
        feedRelays,
        [subscribePostsFilter],
        {
          onevent(event) {
            if (eventsIds.has(event.id))
              return;
            const nip10Data = nip10_exports.parse(event);
            if (nip10Data.reply || nip10Data.root)
              return;
            newEvents.value.push({ id: event.id, pubkey: event.pubkey });
            feedStore.pushToNewEventsToShow({ id: event.id, pubkey: event.pubkey });
          }
        }
      );
      curInterval = setInterval(updateNewEventsElement, 3e3);
    }
    const loadNewRelayEvents = async () => {
      if (feedStore.isLoadingNewEvents)
        return;
      feedStore.setLoadingNewEventsStatus(true);
      const relays = relayStore.connectedFeedRelaysUrls;
      if (!relays.length)
        return;
      router2.push({ path: `${route.path}` });
      let eventsToShow = feedStore.newEventsToShow;
      feedStore.updateNewEventsToShow(feedStore.newEventsToShow.filter((item) => !eventsToShow.includes(item)));
      const ids = eventsToShow.map((e) => e.id);
      const limit = DEFAULT_EVENTS_COUNT;
      feedStore.updatePaginationEventsIds(feedStore.paginationEventsIds.concat(ids));
      const firstPageIds = feedStore.paginationEventsIds.slice(-limit);
      const postsEvents = await pool.querySync(relays, { ids: firstPageIds });
      const authors = Array.from(/* @__PURE__ */ new Set([...postsEvents.map((e) => e.pubkey)]));
      const authorsAndData = await Promise.all([
        Promise.all(
          authors.map(async (author) => {
            return pool.get(relays, { kinds: [0], authors: [author] });
          })
        ),
        injectDataToRootNotes(postsEvents, relays, pool)
      ]);
      const authorsEvents = authorsAndData[0];
      let posts = injectAuthorsToNotes(postsEvents, authorsEvents);
      posts.forEach((e) => eventsIds.add(e.id));
      posts = posts.sort((a, b) => b.created_at - a.created_at);
      feedStore.updateEvents(posts);
      feedStore.setShowNewEventsBadge(false);
      feedStore.setLoadingNewEventsStatus(false);
      logHtmlParts([
        { type: "text", value: `loaded ${eventsToShow.length}` },
        { type: "text", value: " new event(s) from " },
        { type: "bold", value: relayStore.connectedFeedRelaysPrettyStr }
      ]);
    };
    const broadcastEvent = async (event, type) => {
      let writeRelays = relayStore.writeRelays;
      if (type === "json") {
        const rawAdditionalUrls = relayStore.additionalRelaysUrlsForSignedEvent;
        let connectedJsonRelays = [];
        if (rawAdditionalUrls.length) {
          let error = "Can't connect to these relays: ";
          let isError2 = false;
          for (const url of rawAdditionalUrls) {
            if (!(url == null ? void 0 : url.length))
              continue;
            if (!await isWsAvailable(url)) {
              isError2 = true;
              error += `${url}, `;
              continue;
            }
            connectedJsonRelays.push(url);
          }
          const connectedRelayUrl = relayStore.currentRelay.url;
          if (!await isWsAvailable(connectedRelayUrl)) {
            isError2 = true;
            error += `${connectedRelayUrl}`;
          }
          if (isError2) {
            error += `. Relays are unavailable or you are offline.`;
            jsonErr.value = error;
            isSendingMessage.value = false;
            return;
          }
        }
        writeRelays = [relayStore.currentRelay.url, ...connectedJsonRelays];
        writeRelays = [...new Set(writeRelays)];
      }
      if (isSendingMessage.value)
        return;
      isSendingMessage.value = true;
      const relaysToWatch = relayStore.connectedUserReadRelayUrls;
      let userSub = null;
      if (relaysToWatch.length) {
        const userNewEventOptions = [{ kinds: [1], ids: [event.id], limit: 1 }];
        userSub = pool.subscribeMany(
          relaysToWatch,
          userNewEventOptions,
          {
            async onevent(event2) {
              const interval = setInterval(async () => {
                if (newEvents.value.some((e) => e.id == event2.id)) {
                  clearInterval(interval);
                  await loadNewRelayEvents();
                  userSub == null ? void 0 : userSub.close();
                }
              }, 100);
            }
          }
        );
      }
      const result = await publishEventToRelays(writeRelays, pool, event);
      result.forEach((data) => {
        if (data.success) {
          logHtmlParts([
            { type: "text", value: "✅ new event broadcasted to " },
            { type: "bold", value: data.relay }
          ]);
        } else {
          logHtmlParts([
            { type: "text", value: "❌ failed to publish to " },
            { type: "bold", value: data.relay }
          ]);
        }
      });
      const isAllError = result.every((r) => r.success === false);
      if (isAllError && type === "json" && relaysToWatch.length) {
        userSub == null ? void 0 : userSub.close();
      }
      const isError = result.some((r) => r.success === false);
      if (!isError) {
        if (type === "text") {
          feedStore.updateMessageToBroadcast("");
        }
        if (type === "json") {
          feedStore.updateSignedJson("");
        }
      }
      isSendingMessage.value = false;
    };
    const handleRelayDisconnect = () => {
      if (!relayStore.isConnectedToRelay)
        return;
      clearInterval(curInterval);
      feedStore.setShowNewEventsBadge(false);
      newEvents.value = [];
      feedStore.updateNewEventsToShow([]);
      const relay = relayStore.currentRelay;
      relay.close();
      relaysSub == null ? void 0 : relaysSub.close();
      relayStore.setConnectedUserReadRelayUrls([]);
      relayStore.setConnectedFeedRelayUrls([]);
      relayStore.setReedRelays([]);
      relayStore.setWriteRelays([]);
      logHtmlParts([
        { type: "text", value: "disconnected from " },
        { type: "bold", value: relay.url }
      ]);
    };
    return (_ctx, _cache) => {
      const _component_router_link = resolveComponent("router-link");
      const _component_router_view = resolveComponent("router-view");
      return openBlock(), createElementBlock(Fragment, null, [
        createVNode(HeaderFields, {
          onRelayConnect: handleRelayConnect,
          onRelayDisconnect: handleRelayDisconnect,
          wsError: wsError.value
        }, null, 8, ["wsError"]),
        createBaseVNode("div", _hoisted_1, [
          createVNode(_component_router_link, {
            class: "tab-link",
            to: "/feed"
          }, {
            default: withCtx(() => [
              createTextVNode("Feed")
            ]),
            _: 1
          }),
          createVNode(_component_router_link, {
            class: "tab-link",
            to: userTabLink.value
          }, {
            default: withCtx(() => [
              createTextVNode("User")
            ]),
            _: 1
          }, 8, ["to"]),
          createVNode(_component_router_link, {
            class: "tab-link",
            to: "/message"
          }, {
            default: withCtx(() => [
              createTextVNode("Message")
            ]),
            _: 1
          }),
          createVNode(_component_router_link, {
            class: "tab-link",
            to: "/chat"
          }, {
            default: withCtx(() => [
              createTextVNode("Chat")
            ]),
            _: 1
          }),
          createVNode(_component_router_link, {
            class: "tab-link",
            to: "/help"
          }, {
            default: withCtx(() => [
              createTextVNode("Help")
            ]),
            _: 1
          }),
          createVNode(_component_router_link, {
            class: "tab-link",
            to: "/log"
          }, {
            default: withCtx(() => [
              createTextVNode("Log")
            ]),
            _: 1
          }),
          createVNode(_component_router_link, {
            class: "tab-link",
            to: "/settings"
          }, {
            default: withCtx(() => [
              createTextVNode("Settings")
            ]),
            _: 1
          })
        ]),
        createVNode(_component_router_view, {
          name: "messageInput",
          onBroadcastEvent: broadcastEvent,
          isSendingMessage: isSendingMessage.value,
          sentEventIds: unref(sentEventIds),
          broadcastNotice: broadcastNotice.value
        }, null, 8, ["isSendingMessage", "sentEventIds", "broadcastNotice"]),
        createVNode(_component_router_view, {
          name: "signedEventInput",
          onBroadcastEvent: broadcastEvent,
          isSendingMessage: isSendingMessage.value,
          broadcastError: jsonErr.value
        }, null, 8, ["isSendingMessage", "broadcastError"]),
        createVNode(_component_router_view, {
          onLoadNewRelayEvents: loadNewRelayEvents,
          onHandleRelayConnect: handleRelayConnect,
          handleRelayConnect,
          eventsLog: eventsLog.value
        }, null, 8, ["eventsLog"])
      ], 64);
    };
  }
});
const App_vue_vue_type_style_index_0_scoped_09639047_lang = "";
const App = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-09639047"]]);
const app = createApp(App);
const pinia = createPinia();
app.use(router).use(pinia).mount("#app");

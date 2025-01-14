//
// For generating a single animated panel of strokes of a Chinese character
//
function Positioner(t) {
  this._options = t,
  this.width = t.width,
  this.height = t.height,
  this._calculateScaleAndOffset()
}
Positioner.prototype.convertExternalPoint = function (t) {
  var e = (t.x - this.xOffset) / this.scale,
  r = (this.height - this.yOffset - t.y) / this.scale;
  return {
    x: e,
    y: r
  }
},
Positioner.prototype._calculateScaleAndOffset = function () {
  //var t = i,
  var t = [{ x: 0, y: -124 }, { x: 1024, y: 900 }],
      e = t[1].x - t[0].x,
      r = t[1].y - t[0].y,
      n = this.width - 2 * this._options.padding,
      o = this.height - 2 * this._options.padding,
      s = n / e,
      a = o / r;
  this.scale = Math.min(s, a);
  var c = this._options.padding + (n - this.scale * e) / 2,
    h = this._options.padding + (o - this.scale * r) / 2;
  this.xOffset = - 1 * t[0].x * this.scale + c,
  this.yOffset = - 1 * t[0].y * this.scale + h
}

function trim(t) {
    return t.replace(/^\s+/, '').replace(/\s+$/, '');
}

function getScalingTransform(t, e) {
  var r = arguments.length > 2 &&
  void 0 !== arguments[2] ? arguments[2] : 0,
  i = new Positioner({
    width: t,
    height: e,
    padding: r
  });
  return {
    x: i.xOffset,
    y: i.yOffset,
    scale: i.scale,
    transform: trim(
      '\n      translate(' + i.xOffset + ', ' + (i.height - i.yOffset) + ')\n      scale(' + i.scale + ', ' + - 1 * i.scale + ')\n    '
    ).replace(/\s+/g, ' ')
  }
}

function Word(t, e) {
  this.symbol = t,
  this.strokes = e
}

function extract(e, r) {
    if (Array.isArray(e)) return e;
    if (Symbol.iterator in Object(e)) return t(e, r);
    throw new TypeError('Invalid attempt to destructure non-iterable instance')
}

function StrokeData(t, e, r) { //t: path, set of medians, index, unnamed: isRadical flag
  var i = arguments.length > 3 &&
  void 0 !== arguments[3] &&
  arguments[3];
  this.path = t,
  this.points = e,
  this.strokeNum = r,
  this.isInRadical = i
}
StrokeData.prototype.getStartingPoint = function () {
  return this.points[0]
};
StrokeData.prototype.getEndingPoint = function () {
  return this.points[this.points.length - 1]
};
function ptDiff(t, e) {
  return {
    x: t.x - e.x,
    y: t.y - e.y
  }
}
function distance(t) {
  return Math.sqrt(Math.pow(t.x, 2) + Math.pow(t.y, 2))
}
function computePathLength_2(t, e) {
  return distance(ptDiff(t, e))
}
function computePathLength(t) { //t: points
  var e = t[0],
  r = t.slice(1);
  return r.reduce((function (t, r) {
    var i = computePathLength_2(r, e);
    return e = r,
    t + i
  }), 0)
}
StrokeData.prototype.getLength = function () {
  return computePathLength(this.points)
};
StrokeData.prototype.getVectors = function () {
  var t = this.points[0],
  e = this.points.slice(1);
  return e.map((function (e) {
    var r = n(e, t);
    return t = e,
    r
  }))
};
StrokeData.prototype.getDistance = function (t) {
  var e = this.points.map((function (e) {
    return o(e, t)
  }));
  return Math.min.apply(Math, e)
};
StrokeData.prototype.getAverageDistance = function (t) {
  var e = this,
  r = t.reduce((function (t, r) {
    return t + e.getDistance(r)
  }), 0);
  return r / t.length
};


function Character(t, e) {
    function isRadStroke(e) {
        return t.radStrokes &&
        t.radStrokes.indexOf(e) >= 0
    }
  var r = e.strokes.map(
    (
      function (r, o) {
        var s = e.medians[o].map((function (t) {
          var e = extract(t, 2),
          r = e[0],
          n = e[1];
          return {
            x: r,
            y: n
          }
        }));
        return new StrokeData(r, s, o, isRadStroke(o))
      }
    )
  );
  return new Word(t, r);
}

function temp(t) {
  var e = function (e) {
    return t.radStrokes &&
    t.radStrokes.indexOf(e) >= 0
  };
  return t.strokes.map(
    (
      function (r, o) {
        var s = t.medians[o].map((function (t) {
          var e = extract(t, 2),
          r = e[0],
          n = e[1];
          return {
            x: r,
            y: n
          }
        }));
        return new n(r, s, o, e(o))
      }
    )
  )
}

function BaseStroke() {
}
BaseStroke.prototype._getStrokeDashoffset = function (t) {
  return 0.999 * this._pathLength * (1 - t)
};
BaseStroke.prototype._getColor = function (t) {
  var e = t.strokeColor,
  r = t.radicalColor;
  return r &&
    this._stroke.isInRadical ? r : e
};

function urlIdRef(t) {
  var r = '';
  /*
  return window.location &&
      window.location.href &&
      (r = e.location.href.replace(/#[^#]*$/, '')),
      'url(' + r + '#' + t + ')';
  */
  return `url(#${t})`;
}

function _filterParallelPoints(t) {
  if (t.length < 3) return t;
  var e = [
    t[0],
    t[1]
  ];
  return t.slice(2).forEach(
    (
      function (t, r) {
        var i = e.length,
        n = ptDiff(t, e[i - 1]),
        o = ptDiff(e[i - 1], e[i - 2]),
        a = n.y * o.x - n.x * o.y === 0;
        a &&
        e.pop(),
        e.push(t)
      }
    )
  ),
  e
}
function _extendPointOnLine(t, e, r) {
  var i = ptDiff(e, t),
  n = r / distance(i);
  return {
    x: e.x + n * i.x,
    y: e.y + n * i.y
  }
}
function extendStart(t, e) {
  var r = _filterParallelPoints(t);
  if (r.length < 2) return r;
  var i = r[1],
  n = r[0],
  o = _extendPointOnLine(i, n, e),
  s = r.slice(1);
  return s.unshift(o),
  s
}

function round(t) {
  var e = arguments.length > 1 &&
  void 0 !== arguments[1] ? arguments[1] : 1,
  r = 10 * e;
  return {
    x: Math.round(r * t.x) / r,
    y: Math.round(r * t.y) / r
  }
}

function getPathString(t) {
  var e = arguments.length > 1 &&
  void 0 !== arguments[1] &&
  arguments[1],
  r = round(t[0]),
  i = t.slice(1),
  n = 'M ' + r.x + ' ' + r.y;
  return i.forEach((function (t) {
    var e = round(t);
    n += ' L ' + e.x + ' ' + e.y
  })),
  e &&
  (n += 'Z'),
  n
}

var maskId = 0;
function getNextRunningMaskId() {
  return ++maskId;
}
const DEF_STROKE_WTDTH = 200;
function Stroke(t) {
  this._oldProps = {},
  this._stroke = t,
  this._pathLength = t.getLength() + DEF_STROKE_WTDTH / 2
}
Stroke.prototype = Object.create(BaseStroke.prototype);
Stroke.prototype.mount = function (t) {
  this._animationPath = createElm('path'),
  this._clip = createElm('clipPath'),
  this._strokePath = createElm('path');
  var e = 'mask-' + getNextRunningMaskId();
  setAttributeNS(this._clip, 'id', e),
  setAttributeNS(this._strokePath, 'd', this._stroke.path),
  this._animationPath.style.opacity = 0,
  setAttributeNS(this._animationPath, 'clip-path', urlIdRef(e));
  var r = extendStart(this._stroke.points, DEF_STROKE_WTDTH / 2);
  return setAttributeNS(this._animationPath, 'd', getPathString(r)),
      attrs(
        this._animationPath,
        {
          stroke: '#FFFFFF',
          'stroke-width': DEF_STROKE_WTDTH,
          fill: 'none',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'miter',
          'stroke-dasharray': this._pathLength + ',' + this._pathLength
        }
      ),
      this._clip.appendChild(this._strokePath),
      t.defs.appendChild(this._clip),
      t.svg.appendChild(this._animationPath),
      this
};
Stroke.prototype.render = function (t) {
  if (t !== this._oldProps) {
    t.displayPortion !== this._oldProps.displayPortion &&
    (
      this._animationPath.style.strokeDashoffset = this._getStrokeDashoffset(t.displayPortion)
    );
    var e = this._getColor(t);
    if (e !== this._getColor(this._oldProps)) {
      var r = e.r,
      i = e.g,
      n = e.b,
      s = e.a;
      attrs(this._animationPath, {
        stroke: 'rgba(' + r + ',' + i + ',' + n + ',' + s + ')'
      })
    }
    t.opacity !== this._oldProps.opacity &&
    (this._animationPath.style.opacity = t.opacity),
    this._oldProps = t
  }
};

function CharRenderer(t) {
  this._oldProps = {},
  this._strokeRenderers = t.strokes.map((function (t) {
    return new Stroke(t)
  }))
}
CharRenderer.prototype.mount = function (t) {
  var e = t.createSubRenderTarget();
  this._group = e.svg,
  this._strokeRenderers.forEach((function (t, r) {
    t.mount(e)
  }))
};
CharRenderer.prototype.render = function (t) {
  if (t !== this._oldProps) {
    t.opacity !== this._oldProps.opacity &&
    (
      this._group.style.opacity = t.opacity,
      false || //false <- isMsBrowser <- n
      (
        0 === t.opacity ? this._group.style.display = 'none' : 0 === this._oldProps.opacity &&
        this._group.style.removeProperty('display')
      )
    );
    var e = !this._oldProps ||
    t.strokeColor !== this._oldProps.strokeColor ||
    t.radicalColor !== this._oldProps.radicalColor;
    if (e || t.strokes !== this._oldProps.strokes) for (var r = 0; r < this._strokeRenderers.length; r++) !e &&
    this._oldProps.strokes &&
    t.strokes[r] === this._oldProps.strokes[r] ||
    this._strokeRenderers[r].render({
      strokeColor: t.strokeColor,
      radicalColor: t.radicalColor,
      opacity: t.strokes[r].opacity,
      displayPortion: t.strokes[r].displayPortion
    });
    this._oldProps = t
  }
};

  function HanziWriterRenderer(t, e) {
    this._character = t,
    this._positioner = e,
    this._mainCharRenderer = new CharRenderer(t),
    this._outlineCharRenderer = new CharRenderer(t),
    this._highlightCharRenderer = new CharRenderer(t),
    this._userStrokeRenderers = {}
  }
  HanziWriterRenderer.prototype.mount = function (t) {
    var e = t.createSubRenderTarget(),
    r = e.svg;
    setAttributeNS(
      r,
      'transform',
      '\n    translate(' + this._positioner.xOffset + ', ' + (this._positioner.height - this._positioner.yOffset) + ')\n    scale(' + this._positioner.scale + ', ' + - 1 * this._positioner.scale + ')\n  '
    ),
    this._outlineCharRenderer.mount(e),
    this._mainCharRenderer.mount(e),
    this._highlightCharRenderer.mount(e),
    this._positionedTarget = e
  };
  HanziWriterRenderer.prototype.render = function (t) {
    var e = this;
    this._outlineCharRenderer.render({
      opacity: t.character.outline.opacity,
      strokes: t.character.outline.strokes,
      strokeColor: t.options.outlineColor
    }),
    this._mainCharRenderer.render({
      opacity: t.character.main.opacity,
      strokes: t.character.main.strokes,
      strokeColor: t.options.strokeColor,
      radicalColor: t.options.radicalColor
    }),
    this._highlightCharRenderer.render({
      opacity: t.character.highlight.opacity,
      strokes: t.character.highlight.strokes,
      strokeColor: t.options.highlightColor
    });
    var r = t.userStrokes ||
    {
    };
    Object.keys(this._userStrokeRenderers).forEach(
      (
        function (t) {
          r[t] ||
          (
            e._userStrokeRenderers[t].destroy(),
            delete e._userStrokeRenderers[t]
          )
        }
      )
    ),
    Object.keys(r).forEach(
      (
        function (i) {
          if (r[i]) {
            var o = s({
              strokeWidth: t.options.drawingWidth,
              strokeColor: t.options.drawingColor
            }, r[i]),
            a = e._userStrokeRenderers[i];
            a ||
            (
              a = new n,
              a.mount(e._positionedTarget, o),
              e._userStrokeRenderers[i] = a
            ),
            a.render(o)
          }
        }
      )
    )
  };
  HanziWriterRenderer.prototype.destroy = function () {
    a.removeElm(this._positionedTarget.svg),
    this._positionedTarget.defs.innerHTML = ''
  };

function colorStringToVals(t) {
  var e = t.toUpperCase().trim();
  if (/^#([A-F0-9]{3}){1,2}$/.test(e)) {
    var r = e.substring(1).split('');
    3 === r.length &&
    (r = [
      r[0],
      r[0],
      r[1],
      r[1],
      r[2],
      r[2]
    ]);
    var i = '' + r.join('');
    return {
      r: parseInt(i.slice(0, 2), 16),
      g: parseInt(i.slice(2, 4), 16),
      b: parseInt(i.slice(4, 6), 16),
      a: 1
    }
  }
  var n = e.match(
    /^RGBA?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d*\.?\d+))?\)$/
  );
  if (n) return {
    r: parseInt(n[1], 10),
    g: parseInt(n[2], 10),
    b: parseInt(n[3], 10),
    a: parseFloat(n[4] || 1, 10)
  };
  throw new Error('Invalid color: ' + t)
}

function Animator(t, e, r) {
  this._onStateChange = r,
  this._mutationChains = [],
  this.state = {
    options: {
      drawingFadeDuration: e.drawingFadeDuration,
      drawingWidth: e.drawingWidth,
      drawingColor: colorStringToVals(e.drawingColor),
      strokeColor: colorStringToVals(e.strokeColor),
      outlineColor: colorStringToVals(e.outlineColor),
      radicalColor: colorStringToVals(e.radicalColor || e.strokeColor),
      highlightColor: colorStringToVals(e.highlightColor)
    },
    character: {
      main: {
        opacity: e.showCharacter ? 1 : 0,
        strokes: {
        }
      },
      outline: {
        opacity: e.showOutline ? 1 : 0,
        strokes: {
        }
      },
      highlight: {
        opacity: 1,
        strokes: {
        }
      }
    },
    userStrokes: null
  };
  for (var i = 0; i < t.strokes.length; i++) this.state.character.main.strokes[i] = {
    opacity: 1,
    displayPortion: 1
  },
  this.state.character.outline.strokes[i] = {
    opacity: 1,
    displayPortion: 1
  },
  this.state.character.highlight.strokes[i] = {
    opacity: 0,
    displayPortion: 1
  }
}
Animator.prototype.updateState = function (t) {
  var e = n(this.state, t);
  this._onStateChange(e, this.state),
  this.state = e
};
Animator.prototype.run = function (t) {
  var e = this,
  r = arguments.length > 1 &&
  void 0 !== arguments[1] ? arguments[1] : {
  },
  i = t.map((function (t) {
    return t.scope
  })).filter((function (t) {
    return t
  }));
  return this.cancelMutations(i),
  new Promise(
    (
      function (n) {
        var o = {
          _isActive: !0,
          _index: 0,
          _resolve: n,
          _mutations: t,
          _loop: r.loop,
          _scopes: i
        };
        e._mutationChains.push(o),
        e._run(o)
      }
    )
  )
};
Animator.prototype._run = function (t) {
  var e = this;
  if (t._isActive) {
    var r = t._mutations;
    if (t._index >= r.length) {
      if (!t._loop) return t._isActive = !1,
      this._mutationChains = this._mutationChains.filter((function (e) {
        return e !== t
      })),
      void t._resolve({
        canceled: !1
      });
      t._index = 0
    }
    var i = t._mutations[t._index];
    i.run(this).then((function () {
      t._isActive &&
      (t._index++, e._run(t))
    }))
  }
};
Animator.prototype._getActiveMutations = function () {
  return this._mutationChains.map((function (t) {
    return t._mutations[t._index]
  }))
};
Animator.prototype.pauseAll = function () {
  this._getActiveMutations().forEach((function (t) {
    return t.pause()
  }))
};
Animator.prototype.resumeAll = function () {
  this._getActiveMutations().forEach((function (t) {
    return t.resume()
  }))
};
Animator.prototype.cancelMutations = function (t) {
  var e = this;
  this._mutationChains.forEach(
    (
      function (r) {
        r._scopes.forEach(
          (
            function (i) {
              t.forEach(
                (
                  function (t) {
                    (i.indexOf(t) >= 0 || t.indexOf(i) >= 0) &&
                    e._cancelMutationChain(r)
                  }
                )
              )
            }
          )
        )
      }
    )
  )
};
Animator.prototype.cancelAll = function () {
  this.cancelMutations([''])
};
Animator.prototype._cancelMutationChain = function (t) {
  t._isActive = !1;
  for (var e = t._index; e < t._mutations.length; e++) t._mutations[e].cancel(this);
  t._resolve &&
  t._resolve({
    canceled: !0
  }),
  this._mutationChains = this._mutationChains.filter((function (e) {
    return e !== t
  }))
};

function Listener() {
}
Listener.prototype.addPointerStartListener = function (t) {
  var e = this;
  this.node.addEventListener(
    'mousedown',
    (function (r) {
      t(e._eventify(r, e._getMousePoint))
    })
  ),
  this.node.addEventListener(
    'touchstart',
    (function (r) {
      t(e._eventify(r, e._getTouchPoint))
    })
  )
};
Listener.prototype.addPointerMoveListener = function (t) {
  var e = this;
  this.node.addEventListener(
    'mousemove',
    (function (r) {
      t(e._eventify(r, e._getMousePoint))
    })
  ),
  this.node.addEventListener(
    'touchmove',
    (function (r) {
      t(e._eventify(r, e._getTouchPoint))
    })
  )
};
Listener.prototype.addPointerEndListener = function (t) {
  e.document.addEventListener('mouseup', t),
  e.document.addEventListener('touchend', t)
};
Listener.prototype.getBoundingClientRect = function () {
  return this.node.getBoundingClientRect()
};
Listener.prototype._eventify = function (t, e) {
  var r = this;
  return {
    getPoint: function () {
      return e.call(r, t)
    },
    preventDefault: function () {
      return t.preventDefault()
    }
  }
};
Listener.prototype._getMousePoint = function (t) {
  var e = this.getBoundingClientRect(),
  r = t.clientX - e.left,
  i = t.clientY - e.top;
  return {
    x: r,
    y: i
  }
};
Listener.prototype._getTouchPoint = function (t) {
  var e = this.getBoundingClientRect(),
  r = t.touches[0].clientX - e.left,
  i = t.touches[0].clientY - e.top;
  return {
    x: r,
    y: i
  }
};

function createElm(t) {
    return window.document.createElementNS('http://www.w3.org/2000/svg', t)
}
function setAttributeNS(t, e, r) {
    t.setAttributeNS(null, e, r)
}
function attrs(t, e) {
  Object.keys(e).forEach((function (r) {
    return setAttributeNS(t, r, e[r])
  }))
}
function createRenderTarget(t, e) {
  this.svg = t,
  this.defs = e,
  this.node = t,
  this.node.createSVGPoint &&
  (this._pt = this.node.createSVGPoint())
}
createRenderTarget.prototype = Object.create(Listener.prototype);
createRenderTarget.prototype.createSubRenderTarget = function () {
  var t = createElm('g');
  return this.svg.appendChild(t),
  new createRenderTarget(t, this.defs)
};
createRenderTarget.prototype._getMousePoint = function (t) {
  if (this._pt) {
    this._pt.x = t.clientX,
    this._pt.y = t.clientY;
    var e = this._pt.matrixTransform(this.node.getScreenCTM().inverse());
    return {
      x: e.x,
      y: e.y
    }
  }
  return s.prototype._getMousePoint.call(this, t)
};
createRenderTarget.prototype._getTouchPoint = function (t) {
  if (this._pt) {
    this._pt.x = t.touches[0].clientX,
    this._pt.y = t.touches[0].clientY;
    var e = this._pt.matrixTransform(this.node.getScreenCTM().inverse());
    return {
      x: e.x,
      y: e.y
    }
  }
  return s.prototype._getTouchPoint.call(this, t)
};
createRenderTarget.init = function (t) {
  var r = arguments.length > 1 &&
  void 0 !== arguments[1] ? arguments[1] : '100%',
  i = arguments.length > 2 &&
  void 0 !== arguments[2] ? arguments[2] : '100%',
  s = void 0,
  c = t;
  if ('string' === typeof t && (c = e.document.getElementById(t)), !c) throw new Error('HanziWriter target element not found: ' + t);
  var h = c.nodeName.toUpperCase();
  'SVG' === h ||
  'G' === h ? s = c : (s = createElm('svg'), c.appendChild(s)),
  attrs(s, {
    width: r,
    height: i
  });
  var u = createElm('defs');
  return s.appendChild(u),
  new createRenderTarget(s, u)
};

const optionsWriting = {
    "onLoadCharDataError": null,
    "onLoadCharDataSuccess": null,
    "showOutline": true,
    "showCharacter": false,
    "renderer": "svg",
    "width": 180,
    "height": 180,
    "padding": 5,
    "strokeAnimationSpeed": 1,
    "strokeFadeDuration": 400,
    "strokeHighlightDuration": 200,
    "strokeHighlightSpeed": 2,
    "delayBetweenStrokes": 1000,
    "delayBetweenLoops": 2000,
    "strokeColor": "#555",
    "radicalColor": "#168F16",
    "highlightColor": "#AAF",
    "outlineColor": "#DDD",
    "drawingColor": "#333",
    "leniency": 1,
    "showHintAfterMisses": 3,
    "highlightOnComplete": true,
    "highlightCompleteColor": "#AAF",
    "drawingFadeDuration": 300,
    "drawingWidth": 4,
    "strokeWidth": 2,
    "outlineWidth": 2,
    "rendererOverride": {}
};

const renderAreaSettings = {
  "width": 180,
  "height": 180,
  "padding": 5,
  "strokeAnimationSpeed": 1,
  "showCharacter": false,
  "radicalColor": "#168F16"
};

let animId = -1,
    terminateAnim = false;
function animateChar(elemSvg)
{
    //console.log('Begin animation');
    terminateAnim = false;
    //unhide writing layer (which is the 2nd layer)
    const writingLayer = document.getElementsByTagName('svg')[0].getElementsByTagName('g')[0].children[1];
    writingLayer.style.opacity = 1;
    writingLayer.style.display = '';

    var strokes = writingLayer.getElementsByTagName('path'),
        cntStrokes = strokes.length,
        strokeIndex = 0,
        max = 1000,
        strokeOffset = max;
    strokes[0].setAttribute('stroke', 'rgba(22,143,22,1)'); //set 1st stroke to bright green

    function clearStrokes()
    {
        let i = 0;
        for (; i < cntStrokes; ++i)
        {
            strokes[i].style.opacity = '0';
        }
    }

    function updateStrokeMaxOffset(strokeIndex)
    {
        //get: value of stroke-dasharray
        const vals = strokes[strokeIndex].attributes['stroke-dasharray'].value.split(',');
        //parse: "591.2250558111891,591.2250558111891"
        max = parseInt(vals[0]);
        strokeOffset = max;
    }

    function drawStroke()
    {
        if (terminateAnim) return;
        strokes[strokeIndex].style.opacity = '1';
        strokes[strokeIndex].style['stroke-dashoffset'] = `${strokeOffset}px`;
        //strokeOffset -= 30;
        strokeOffset -= max / 20;
        if (strokeOffset < 0)
        {
            strokeOffset = max;
            ++strokeIndex;
            if (strokeIndex >= cntStrokes)
            {
                //return; //terminate instead of loop
                strokeIndex = 0;
                clearStrokes();
            }
            updateStrokeMaxOffset(strokeIndex);
        }
        animId = requestAnimationFrame(drawStroke);
    }

    function toggleAnimateChar()
    {
        if (terminateAnim)
        {
            terminateAnim = false;
            animId = requestAnimationFrame(drawStroke);
        }
        else
        {
            terminateAnim = true;
        }
    }
    elemSvg.onclick = toggleAnimateChar;
    elemSvg.ondblclick = function() //oncontextmenu
    {
        strokeIndex = 0;
        clearStrokes();
    };

    updateStrokeMaxOffset(0);
    clearStrokes();
    animId = requestAnimationFrame(drawStroke);
}

function createWordWriter(elemId, word, json)
{
    try
    {
        let _character = new Character(word, json);
        window._character = _character;
        let _positioner = new Positioner(optionsWriting);
        window._positioner = _positioner;
        var _hanziWriterRenderer = new HanziWriterRenderer(_character, _positioner);
        window._hanziWriterRenderer = _hanziWriterRenderer;
        let _renderState = new Animator(_character, optionsWriting, (function (t) {
            s.render(t)
        }));

        const elemSvg = document.getElementById(elemId),
            defs = createElm('defs');
        const lineAttrs = [{ x1: '0', y1: '0', x2: '180', y2: '180', stroke: '#DDD' },
             { x1: '180', y1: '0', x2: '0', y2: '180', stroke: '#DDD' },
             { x1: '90', y1: '0', x2: '90', y2: '180', stroke: '#DDD' },
             { x1: '0', y1: '90', x2: '180', y2: '90', stroke: '#DDD' }];
        for (let i = 0; i < 4; ++i) //draw diagonal grid
        {
            const newLine = createElm('line');
            attrs(newLine, lineAttrs[i]);
            elemSvg.append(newLine);
        }
        elemSvg.append(defs);
        let target = new createRenderTarget(elemSvg, defs);
        /*{
            defs: createElm('defs'),
            _pt: elemSvg.createSVGPoint(0,0),
            node: elemSvg,
            svg: elemSvg
        };*/
        _hanziWriterRenderer.mount(target, _renderState.state);
        _hanziWriterRenderer.render(_renderState.state);
        animateChar(elemSvg);
        window._renderState = _renderState;
    }
    catch (err)
    {
        console.log('ERR:', err);
    }
    document.getElementById('svgPlaceHolder').remove();
    //console.log('Created: animated panel');
}

//
// For generating panel of each stroke of a Chinese character
//
const hwSize = 76,
    hwSizeHalf = hwSize / 2;
let showUnwrittenStrokes = true;
function renderLines(t) {
    var e = [
      {
        x1: 0,
        y1: 0,
        x2: hwSize,
        y2: hwSize
      },
      {
        x1: hwSize,
        y1: 0,
        x2: 0,
        y2: hwSize
      },
      {
        x1: hwSizeHalf,
        y1: 0,
        x2: hwSizeHalf,
        y2: hwSize
      },
      {
        x1: 0,
        y1: hwSizeHalf,
        x2: hwSize,
        y2: hwSizeHalf
      }
    ];
    e.forEach(
      (
        function (e) {
          var r = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          r.setAttribute('x1', e.x1),
          r.setAttribute('y1', e.y1),
          r.setAttribute('x2', e.x2),
          r.setAttribute('y2', e.y2),
          r.setAttribute('stroke', '#DDD'),
          t.append(r)
        }
      )
    )
}

function renderStrokes(t, strokes, lastStrokeIndex) {
    var r = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    r.style.width = hwSize + 'px';
    r.style.height = hwSize + 'px';
    r.style.border = '1px solid #EEE';
    r.style.marginRight = '3px';
    r.style.marginBottom = '3px';
    r.style.backgroundColor = '#FFF';
    t.appendChild(r);
    renderLines(r);

    var i = document.createElementNS('http://www.w3.org/2000/svg', 'g'),
        n = getScalingTransform(76, 76);
    i.setAttributeNS(null, 'transform', n.transform);
    r.appendChild(i);
    //1. Draw 'unwritten' strokes lightly, in the background
    if (showUnwrittenStrokes)
    {
        for (let index = lastStrokeIndex + 1; index < strokes.length; ++index)
        {
            const r = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            r.setAttributeNS(null, 'd', strokes[index]);
            r.style.fill = '#ddd';
            i.appendChild(r);
        }
    }
    let index = 0;
    //2. Draw 'written' strokes
    for (; index < lastStrokeIndex; ++index)
    {
        const r = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        r.setAttributeNS(null, 'd', strokes[index]);
        r.style.fill = '#666';
        i.appendChild(r);
    }
    //3. Draw last, highlighted 'written' stroke
    r = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    r.setAttributeNS(null, 'd', strokes[index]);
    r.style.fill = '#dc3545';
    i.appendChild(r);
    /*
    e.forEach(
      (
        function (t, index) {
          const r = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          r.setAttributeNS(null, 'd', t);
          if (index < lastStrokeIndex)
            r.style.fill = '#666';
          else if (index > lastStrokeIndex)
            r.style.fill = '#cccc';
          else
            r.style.fill = '#dc3545';
          i.appendChild(r);
        }
      )
    )
    */
}

function createStrokesView(json, elemId) { //json: JSON from <word>.json
    const r = document.getElementById(elemId);
    for (
        i = 0;
        i < json.strokes.length;
        i++
    ) {
        renderStrokes(r, json.strokes, i);
    }
    document.getElementById('svgPlaceHolder2').remove();
    //console.log('Created: strokes panel');

    r.onclick = function() {
        showUnwrittenStrokes = !showUnwrittenStrokes;
        r.innerHTML = '';
        createStrokesView(json, elemId);
    };
}
function NodeGetDepth(node) {
    var depth = 0;
    while (node.parent) {
        node = node.parent;
        depth++;
    }
    return depth;
}

var MAX_DEPTH = 0;

function Node(parent, el) {
    var node = {
        parent   : parent || null,
        children : [],
        el       : el,
        x        : window.innerWidth * 0.5,
        y        : window.innerHeight * 0.5,
        dx       : 0,
        dy       : 0
    };

    node.depth = NodeGetDepth(node);
    if (node.depth > MAX_DEPTH) {
        MAX_DEPTH = node.depth;
    }

    if (node.parent) {
        node.parentLine = Line({ start : node.parent, end : node });
        lines.push(node.parentLine);
        node.parent.children.push(node);
    }

    return node;
}

var MAX_UPDATE_FRAMES      = 30;
var framesLeftForAnimation = MAX_UPDATE_FRAMES;

var CHILD_LINE_OPTIONS = {
    strokeStyle : 'rgb(210,210,210)',
    lineWidth   : '1px'
};

function repositionGraphToOrigin() {
    var minX = Infinity;
    var maxX = -Infinity;
    var minY = Infinity;
    var maxY = -Infinity;

    nodes.forEach(function (n) {
        if (n.x > maxX) {
            maxX = n.x;
        }
        if (n.x < minX) {
            minX = n.x;
        }
        if (n.y > maxY) {
            maxY = n.y;
        }
        if (n.y < minY) {
            minY = n.y;
        }
    });

    // Add edge padding
    var padding = 40;
    minX -= padding;
    maxX += padding;
    minY -= padding;
    maxY += padding;

    var canvasWidth  = maxX - minX;
    var canvasHeight = maxY - minY;

    var canvas    = document.querySelector('canvas');
    canvas.width  = canvasWidth;
    canvas.height = canvasHeight;

    moveAllNodesImmediate(-minX, -minY);
}

function NodeAnimate() {
    if (framesLeftForAnimation > 0) {
        // Settle
        nodes.forEach(NodeUpdatePosition);
        framesLeftForAnimation--;
    } else if (framesLeftForAnimation === 0) {
        repositionGraphToOrigin();

        CTX2D.clearRect(0, 0, window.innerWidth, window.innerHeight);
        lines.forEach(LineUpdatePosition.bind(null, CHILD_LINE_OPTIONS));
        nodes.forEach(NodeUpdateStyle);
        showAllNodes();
        framesLeftForAnimation = -1;
    }
}

var MAX_FORCE        = 0.3;
var TIME_PERIOD      = 70;
var REPULSE_FORCE2   = 20;
var FORCE_FACTOR     = 0.004;
var DAMPENING_FACTOR = 0.25;

// For numerical purposes to avoid division by 0
var MIN_DISTANCE = 0.00000000001;

function NodeGetForceVector(node) {
    var f          = { x : 0, y : 0 };
    var bounding   = node.el.getBoundingClientRect();
    var nodeWidth  = bounding.width * 0.5;
    var nodeHeight = bounding.height * 0.5;
    var NODE_SIZE2 = nodeWidth * nodeWidth + nodeHeight * nodeHeight;

    function addRepulsiveForce(n) {
        if (n === node) return;
        if (!n) return;

        var b      = n.el.getBoundingClientRect();
        var DRATIO = 2;
        var w      = b.width * DRATIO;
        var h      = b.height * DRATIO;

        var N_SIZE2           = w * w + h * h;
        var REPULSE_THRESHOLD = NODE_SIZE2 + N_SIZE2;

        var dx    = node.x - n.x + MIN_DISTANCE;
        var dy    = node.y - n.y + MIN_DISTANCE;
        var dist2 = (dx * dx) + (dy * dy);

        if (dist2 < REPULSE_THRESHOLD) {
            var sign  = dx > 0 ? 1 : -1;
            var theta = Math.atan(dy / dx);
            f.x += REPULSE_FORCE2 * REPULSE_THRESHOLD / dist2 * Math.cos(theta) * sign;
            f.y += REPULSE_FORCE2 * REPULSE_THRESHOLD / dist2 * Math.sin(theta) * sign;
        }
    }

    nodes.forEach(addRepulsiveForce);

    if (Math.abs(f.x) > MAX_FORCE) {
        f.x = f.x > 0 ? MAX_FORCE : -MAX_FORCE;
    }

    if (Math.abs(f.y) > MAX_FORCE) {
        f.y = f.y > 0 ? MAX_FORCE : -MAX_FORCE;
    }

    return f;
}

function NodeUpdatePosition(node) {
    var forces = NodeGetForceVector(node);
    node.dx += forces.x * TIME_PERIOD;
    node.dy += forces.y * TIME_PERIOD;

    node.dx *= DAMPENING_FACTOR;
    node.dy *= DAMPENING_FACTOR;

    if (Math.abs(node.dx + node.dy) > 2) {
        node.x += node.dx * TIME_PERIOD * FORCE_FACTOR;
        node.y += node.dy * TIME_PERIOD * FORCE_FACTOR;
    }
}

function NodeUpdateStyle(node) {
    node.el.style.transform = 'translate(' + node.x + 'px, ' + node.y + 'px)';
}

function Line(options) {
    return {
        start : options.start,
        end   : options.end
    };
}

var LINE_WIDTH = [9, 6, 3, 2];

function LineUpdatePosition(options, line) {
    var startBounding = line.start.el.getBoundingClientRect();
    var endBounding   = line.end.el.getBoundingClientRect();
    CTX2D.strokeStyle = options.strokeStyle;
    CTX2D.lineWidth   = LINE_WIDTH[line.start.depth] || LINE_WIDTH[LINE_WIDTH.length - 1];

    CTX2D.beginPath();
    CTX2D.moveTo(line.start.x + startBounding.width * 0.5, line.start.y + startBounding.height * 0.5);
    CTX2D.lineTo(line.end.x + endBounding.width * 0.5, line.end.y + endBounding.height * 0.5);
    CTX2D.stroke();
}

var CTX2D;

var nodes      = [];
var lines      = [];
var activeNode = null;

function addLI(parent, li) {
    var node = Node(parent, li);
    nodes.push(node);

    var peChildren = [].slice.call(li.parentElement.children);
    var nextEl     = peChildren[peChildren.indexOf(li) + 1];
    if (nextEl && nextEl.tagName === 'UL') {
        var children = [].slice.call(nextEl.children)
            .filter(function (c) {
                return c.tagName === 'LI';
            });

        if (children.length > 0) {
            children.forEach(addLI.bind(0, node));
            node.el.setAttribute('data-has-children', 'true');
        }
    }
}

var raf;

function go() {
    NodeAnimate(activeNode);
    raf = requestAnimationFrame(go);
}

function showAllNodes() {
    nodes.forEach(function (n) {n.el.className = 'show';});
}

var CHILD_NODE_INITIAL_DISTANCE = 220;

function layoutNodeChildren(node) {
    var pdx    = 0;
    var pdy    = 0;
    var pAngle = 0;
    var sign   = 1;
    var dAngle;
    var range;
    var startAngle;

    if (node.parent) {
        pdx = node.parent.x - node.x + MIN_DISTANCE;
        pdy = node.parent.y - node.y + MIN_DISTANCE;

        sign = pdx > 0 ? 1 : -1;

        pAngle = Math.atan(pdy / pdx);

        range = Math.PI / 2;

        dAngle = range / Math.max(node.children.length, 1);

        if (node.children.length === 1) {
            startAngle = pAngle - Math.PI;
        } else {
            startAngle = pAngle - Math.PI - range / 2;
        }
    } else {
        node.x     = window.innerWidth * 0.5;
        node.y     = window.innerHeight * 0.5;
        range      = Math.PI * 2;
        dAngle     = range / Math.max(node.children.length, 1);
        startAngle = pAngle - Math.PI - range / 2;
    }

    node.children
        .forEach(function (n, i) {
            n.x = node.x;
            n.y = node.y;

            n.x += Math.cos(startAngle + i * dAngle) * CHILD_NODE_INITIAL_DISTANCE * sign;
            n.y += Math.sin(startAngle + i * dAngle) * CHILD_NODE_INITIAL_DISTANCE * sign;

            NodeUpdateStyle(n);
        });

    node.children
        .forEach(layoutNodeChildren);
}

function setRootNode(node) {
    layoutNodeChildren(node);
    go();
}

function moveAllNodesImmediate(dx, dy) {
    nodes.forEach(function (n) {
        n.x += dx;
        n.y += dy;
    });
}

var PAN_SPEED = 4;

function onMouseMove(e) {
    if (e.which === 1) {
        var dx = window.innerWidth * 0.5 - e.clientX;
        var dy = window.innerHeight * 0.5 - e.clientY;

        moveAllNodesImmediate(
            dx * PAN_SPEED * FORCE_FACTOR,
            dy * PAN_SPEED * FORCE_FACTOR
        );
    }
}

function onClick(e) {
    if (e.target.tagName === 'A') {
        e.target.target = "_blank";
    }
}

function onMarkdownLoaded(md) {
    var div       = document.createElement('div');
    div.className = "markdown";
    div.innerHTML = micromarkdown.parse(md, true);
    document.body.appendChild(div);

    CTX2D = document.querySelector('canvas').getContext('2d');

    addLI(null, document.body.querySelector('.markdown > ul > li'));
    framesLeftForAnimation = MAX_UPDATE_FRAMES;
    setRootNode(nodes[0]);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onClick)
}

function XHR(method, url, onDone) {
    var request                = new XMLHttpRequest();
    request.onreadystatechange = function () {
        var DONE = this.DONE || 4;
        if (this.readyState === DONE) {
            onDone(this.responseText);
        }
    };
    request.open(method, url, true);
    request.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    request.send(null);
}

document.addEventListener('DOMContentLoaded', function onDOMContentLoaded() {
    XHR('GET', document.body.getAttribute('data-markdown-url'), onMarkdownLoaded);
});

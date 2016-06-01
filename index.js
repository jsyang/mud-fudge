function onNodeClick(nextActiveNode, e) {
    if (e.target.tagName === 'A') {
        e.target.target = "_blank";
    } else {
        setActiveNode(nextActiveNode);
    }
}

function Node(parent, depth, el) {
    var parentLine;

    var node = {
        depth    : depth,
        parent   : parent || null,
        children : [],
        el       : el,
        x        : window.innerWidth * 0.5,
        y        : window.innerHeight * 0.5,
        dx       : 0,
        dy       : 0
    };

    if (node.parent) {
        parentLine = Line({ start : node.parent, end : node });
        lines.push(parentLine);
        node.parent.children.push(node);
        node.parentLine = parentLine;
    }

    el.addEventListener('click', onNodeClick.bind(0, node));

    return node;
}

var MAX_UPDATE_FRAMES      = 30;
var framesLeftForAnimation = MAX_UPDATE_FRAMES;

var CHILD_LINE_OPTIONS = {
    strokeStyle : 'black',
    lineWidth   : '1px'
};

var PARENT_LINE_OPTIONS = {
    strokeStyle : 'rgb(210,210,210)',
    lineWidth   : '1px'
};

function NodeAnimate(node) {
    if (framesLeftForAnimation > 0) {
        CTX2D.clearRect(0, 0, window.innerWidth, window.innerHeight);

        node.children
            .concat(node.parent)
            .concat(node)
            .filter(Boolean)
            .forEach(NodeUpdatePosition);

        framesLeftForAnimation--;
    } else if (framesLeftForAnimation === 0) {

        node.children
            .concat(node.parent)
            .concat(node)
            .filter(Boolean)
            .forEach(NodeUpdateStyle);

        if (node.parent) {
            LineUpdatePosition(PARENT_LINE_OPTIONS, node.parentLine);
        }

        node.children
            .forEach(function (n) {
                LineUpdatePosition(CHILD_LINE_OPTIONS, n.parentLine);
            });

        framesLeftForAnimation = -1;

    }
}

var MAX_FORCE        = 3;
var TIME_PERIOD      = 40;
var REPULSE_FORCE2   = 70;
var ATTRACT_FORCE2   = 10;
var FORCE_FACTOR     = 0.004;
var DAMPENING_FACTOR = 0.35;

// For numerical purposes to avoid division by 0
var MIN_DISTANCE = 0.00000000001;

function NodeGetForceVector(node) {
    var f          = { x : 0, y : 0 };
    var bounding   = node.el.getBoundingClientRect();
    var NODE_SIZE2 = bounding.width * bounding.width + bounding.height * bounding.height;

    function addRepulsiveForce(n) {
        var b                 = n.el.getBoundingClientRect();
        var N_SIZE2           = b.width * b.width + b.height * b.height;
        var REPULSE_THRESHOLD = NODE_SIZE2 + N_SIZE2;

        var dx    = node.x - n.x + MIN_DISTANCE;
        var dy    = node.y - n.y + MIN_DISTANCE;
        var dist2 = (dx * dx) + (dy * dy) + MIN_DISTANCE;

        if (dist2 < REPULSE_THRESHOLD) {
            var sign  = dx > 0 ? 1 : -1;
            var theta = Math.atan(dy / dx);
            f.x += REPULSE_FORCE2 * REPULSE_THRESHOLD / dist2 * Math.cos(theta) * sign;
            f.y += REPULSE_FORCE2 * REPULSE_THRESHOLD / dist2 * Math.sin(theta) * sign;
        }
    }

    function addAttractiveForce(n, isCenterForce) {
        var b                 = n.el ? n.el.getBoundingClientRect() : { width : 0, height : 0 };
        var N_SIZE2           = b.width * b.width + b.height * b.height;
        var ATTRACT_THRESHOLD = NODE_SIZE2 + N_SIZE2;

        var dx    = node.x - n.x + MIN_DISTANCE;
        var dy    = node.y - n.y + MIN_DISTANCE;
        var dist2 = (dx * dx) + (dy * dy) + MIN_DISTANCE;
        if (dist2 > ATTRACT_THRESHOLD || isCenterForce) {
            var forceMultiplier = f.forceMultiplier || 1;

            var sign  = dx > 0 ? 1 : -1;
            var theta = Math.atan(dy / dx);
            f.x -= ATTRACT_FORCE2 * Math.cos(theta) * dist2 * sign * forceMultiplier;
            f.y -= ATTRACT_FORCE2 * Math.sin(theta) * dist2 * sign * forceMultiplier;
        }
    }

    // Attracted to the center of the viewport if node is active
    if (activeNode === node) {
        addAttractiveForce({
            x               : (window.innerWidth - bounding.width) * 0.5,
            y               : (window.innerHeight - bounding.height) * 0.5,
            forceMultiplier : 2.2
        }, true);
    } else {

        nodes
            .filter(function (n) {
                var viable = true;

                viable &= n !== node;
                viable &= Math.abs(n.depth - activeNode.depth) < 2;
                viable &= n.el.classList.contains('show');

                return viable;
            }).forEach(addRepulsiveForce);

        // Attracted to connected nodes
        node.children.concat(node.parent)
            .filter(function (n) {
                return n && n.el.classList.contains('show');
            }).forEach(addAttractiveForce);
    }

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

    if (Math.abs(node.dx + node.dy) > 0.1) {
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

function LineUpdatePosition(options, line) {
    var startBounding = line.start.el.getBoundingClientRect();
    var endBounding   = line.end.el.getBoundingClientRect();
    CTX2D.strokeStyle = options.strokeStyle;
    CTX2D.lineWidth   = options.lineWidth;

    CTX2D.beginPath();
    CTX2D.moveTo(line.start.x + startBounding.width * 0.5, line.start.y + startBounding.height * 0.5);
    CTX2D.lineTo(line.end.x + endBounding.width * 0.5, line.end.y + endBounding.height * 0.5);
    CTX2D.stroke();
}

var CTX2D;

var nodes      = [];
var lines      = [];
var activeNode = null;

function addLI(parent, depth, li) {
    var node = Node(parent, depth, li);
    nodes.push(node);

    var peChildren = [].slice.call(li.parentElement.children);
    var nextEl     = peChildren[peChildren.indexOf(li) + 1];
    if (nextEl && nextEl.tagName === 'UL') {
        var children = [].slice.call(nextEl.children)
            .filter(function (c) {
                return c.tagName === 'LI';
            });

        if (children.length > 0) {
            children.forEach(addLI.bind(0, node, depth + 1));
            node.el.setAttribute('data-has-children', 'true');
        }
    }
}

var raf;

function go() {
    NodeAnimate(activeNode);
    raf = requestAnimationFrame(go);
}

function hideAllNodes() {
    nodes.forEach(function (n) {n.el.className = '';});
}

var prevActiveNode;

function setActiveNode(node) {
    if (node !== activeNode) {
        cancelAnimationFrame(raf);

        hideAllNodes();

        var pdx    = 0;
        var pdy    = 0;
        var pAngle = 0;
        var sign   = 1;

        node.el.className = "show light";
        //node.x = window.innerWidth * 0.5;
        //node.y = window.innerHeight * 0.5;

        if (node.parent) {
            node.parent.el.className = 'show parent';

            pdx = node.parent.x - node.x + MIN_DISTANCE;
            pdy = node.parent.y - node.y + MIN_DISTANCE;

            sign = pdx > 0 ? 1 : -1;

            pAngle = Math.atan(pdy / pdx);
        }

        var CHILD_NODE_INITIAL_DISTANCE = 60;

        var angleIncrement = 1.44 / Math.max(node.children.length - 1, 2);

        node.children
            .forEach(function (n, i) {
                var newAngle;

                n.x = node.x;
                n.y = node.y;

                if (n !== prevActiveNode) {
                    newAngle = pAngle + 3.14 - 0.72 + i * angleIncrement;
                    n.x += Math.cos(newAngle) * CHILD_NODE_INITIAL_DISTANCE * sign;
                    n.y += Math.sin(newAngle) * CHILD_NODE_INITIAL_DISTANCE * sign;
                } else {
                    newAngle = pAngle;
                    n.x += Math.cos(newAngle) * CHILD_NODE_INITIAL_DISTANCE * sign;
                    n.y += Math.sin(newAngle) * CHILD_NODE_INITIAL_DISTANCE * sign;
                }

                n.el.className = "show";

                NodeUpdateStyle(n);
            });

        prevActiveNode = activeNode;
        activeNode     = node;

        go();
        framesLeftForAnimation = MAX_UPDATE_FRAMES;

    } else if (activeNode && activeNode.parent) {
        setActiveNode(activeNode.parent);
    }
}

function onDOMContentLoaded() {
    var md        = document.querySelector('script[type="text/markdown"]').innerHTML;
    var div       = document.createElement('div');
    div.className = "markdown";
    div.innerHTML = micromarkdown.parse(md, true);
    document.body.appendChild(div);

    CTX2D = document.querySelector('canvas').getContext('2d');

    var root = document.body.querySelector('.markdown > ul > li');
    root.classList.add('root');

    addLI(null, 0, root);
    setActiveNode(nodes[0]);

    window.addEventListener('resize', onResize);
    onResize();
}

function onResize() {
    var canvas    = document.querySelector('canvas');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    cancelAnimationFrame(raf);
    framesLeftForAnimation = MAX_UPDATE_FRAMES;
    go();
}

document.addEventListener('DOMContentLoaded', onDOMContentLoaded);

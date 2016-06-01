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

var MAX_UPDATE_FRAMES      = 70;
var framesLeftForAnimation = MAX_UPDATE_FRAMES;

function NodeAnimate(node) {
    if (framesLeftForAnimation > 0) {
        CTX2D.clearRect(0, 0, window.innerWidth, window.innerHeight);

        lines
            .filter(function (line) {
                return line !== node.parentLine && (line.start === node || line.end === node);
            })
            .forEach(LineUpdatePosition.bind(0, {
                strokeStyle : 'black',
                lineWidth   : '1px'
            }));

        NodeUpdatePosition(node);

        if (node.parent) {
            NodeUpdatePosition(node.parent);
            LineUpdatePosition(
                {
                    strokeStyle : 'rgb(210,210,210)',
                    lineWidth   : '1px'
                },
                node.parentLine
            );
        }
        node.children.forEach(NodeUpdatePosition);

        framesLeftForAnimation--;
    }
}

var VIEWPORT_REPULSE_FORCE = 10;
var ATTRACT_FORCE          = 2;
var REPULSE_FORCE          = 4;
var NODE_RADIAL_SIZE       = 200;
var ATTRACT_FACTOR         = 1 / 50000;
var ATTRACT_FACTOR_1000    = 1 / 1000;
var MAX_FORCE              = 0.1;
var TIME_PERIOD            = 10;
var DAMPENING_FACTOR       = 0.65;
var CENTRE_FORCE           = 20;

function NodeGetForceVector(node) {
    var dist;
    var f;
    var fx = 0;
    var fy = 0;

    var bounding = node.el.getBoundingClientRect();

    // Repulsed by other nodes

    function addRepulsiveForce(n) {
        // Coulomb's Law
        var x1 = n.x - node.x;
        var y1 = n.y - node.y;
        var theta;
        var xsign;

        var dist = Math.sqrt((x1 * x1) + (y1 * y1)) + 0.0000001;
        if (Math.abs(dist) < NODE_RADIAL_SIZE) {
            if (x1 === 0) {
                theta = Math.PI * 0.5;
                xsign = 0;
            } else {
                theta = Math.atan(y1 / x1);
                xsign = x1 >= 0 ? 1 : -1;
            }

            // force is based on radial distance
            f = (REPULSE_FORCE * NODE_RADIAL_SIZE) / (dist * dist);
            fx += -f * Math.cos(theta) * xsign;
            fy += -f * Math.sin(theta) * xsign;
        }
    }

    nodes
        .filter(function (n) {
            var viable = true;

            viable &= n !== node;
            viable &= Math.abs(n.depth - activeNode.depth) < 2;
            viable &= !n.el.classList.contains('hide');

            return viable;
        })
        .forEach(addRepulsiveForce);

    if (node.parent) {
        addRepulsiveForce(node.parent);
    }

    // Add viewport boundary repulsion

    // Left edge
    dist = node.x + bounding.width * 0.5;
    f    = (VIEWPORT_REPULSE_FORCE * NODE_RADIAL_SIZE) / (dist * dist);
    fx += Math.min(2, f);

    // Right edge
    dist = window.innerWidth - dist;
    f    = -(VIEWPORT_REPULSE_FORCE * NODE_RADIAL_SIZE) / (dist * dist);
    fx += Math.max(-2, f);

    // Top edge
    dist = node.y + bounding.height * 0.5;
    f    = (VIEWPORT_REPULSE_FORCE * NODE_RADIAL_SIZE) / (dist * dist);
    fy += Math.min(2, f);

    // Bottom edge
    dist = (window.innerHeight - node.y);
    f    = -(VIEWPORT_REPULSE_FORCE * NODE_RADIAL_SIZE) / (dist * dist);
    fy += Math.max(-2, f);

    // Attracted to nodes that we're linked to
    lines
        .filter(function (l) {
            return l.start === node || l.end === node;
        })
        .forEach(function addAttractive(l) {
            var otherEnd = null;

            if (l.start === node) {
                otherEnd = l.end;
            } else if (l.end === node) {
                otherEnd = l.start;
            }

            // Hooke's Law
            var theta;
            var xsign;
            var x1 = (otherEnd.x - node.x);
            var y1 = (otherEnd.y - node.y);
            dist   = Math.sqrt((x1 * x1) + (y1 * y1));
            if (Math.abs(dist) > 0) {
                if (x1 === 0) {
                    theta = Math.PI / 2;
                    xsign = 0;
                }
                else {
                    theta = Math.atan(y1 / x1);
                    xsign = x1 >= 0 ? 1 : -1;
                }

                // force is based on radial distance
                f = ATTRACT_FORCE * dist * ATTRACT_FACTOR;
                fx += f * Math.cos(theta) * xsign;
                fy += f * Math.sin(theta) * xsign;
            }
        });

    // Attracted to the center of the viewport if node is active
    if (activeNode === node) {

        var x1 = window.innerWidth * 0.5 - node.x;
        var y1 = window.innerHeight * 0.5 - node.y;
        dist   = Math.sqrt((x1 * x1) + (y1 * y1));
        if (Math.abs(dist) > 0) {
            if (x1 === 0) {
                var theta = Math.PI / 2;
                var xsign = 0;
            } else {
                var theta = Math.atan(y1 / x1);
                var xsign = x1 >= 0 ? 1 : -1;
            }

            // force is based on radial distance
            f = (0.1 * ATTRACT_FORCE * dist * CENTRE_FORCE) * ATTRACT_FACTOR_1000;
            fx += f * Math.cos(theta) * xsign;
            fy += f * Math.sin(theta) * xsign;
        }
    }

    if (Math.abs(fx) > MAX_FORCE) {
        // todo: this isn't really max force. It's a dampener factor
        fx = MAX_FORCE * (fx / Math.abs(fx));
    }
    if (Math.abs(fy) > MAX_FORCE) {
        fy = MAX_FORCE * (fy / Math.abs(fy));
    }
    return {
        x : fx,
        y : fy
    };
}

// updatePosition returns a boolean stating whether it's been static
function NodeUpdatePosition(node) {

    var forces = NodeGetForceVector(node);
    node.dx += forces.x * TIME_PERIOD;
    node.dy += forces.y * TIME_PERIOD;

    node.dx *= DAMPENING_FACTOR;
    node.dy *= DAMPENING_FACTOR;

    if (Math.abs(node.dx + node.dy) > 0.002) {
        node.x += node.dx * TIME_PERIOD;
        node.y += node.dy * TIME_PERIOD;
        node.el.style.transform = 'translate(' + node.x + 'px, ' + node.y + 'px)';
    }
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
            node.el.classList.add('hasChildren');
        }
    }
}

var raf;

function go() {
    NodeAnimate(activeNode);
    raf = requestAnimationFrame(go);
}

function hideAllNodes() {
    nodes.forEach(function (n) {
        n.el.classList.add('hide');
        n.el.classList.remove('parent');
    });
}

function setActiveNode(node) {
    if (node !== activeNode) {
        cancelAnimationFrame(raf);

        hideAllNodes();

        node.el.classList.remove('hide');
        node.el.classList.add('dark');

        if (node.parent) {
            node.parent.el.classList.remove('hide');
            node.parent.el.classList.add('parent');
        }

        node
            .children
            .forEach(function (n) {
                n.el.classList.remove('hide');
                n.x = node.x;
                n.y = node.y;
            });

        if (activeNode) {
            activeNode.el.classList.remove('dark');
        }

        activeNode = node;

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

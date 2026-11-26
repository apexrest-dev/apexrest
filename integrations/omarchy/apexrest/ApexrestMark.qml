import QtQuick
import QtQuick.Shapes
import qs.Commons

// The APEXREST pencil-and-ruler mark, drawn natively from the paths of
// plugins/apexrest-apex/assets/apexrest-icon.svg (viewBox 100 66 98 98).
// The brand fills stay; the outline follows the bar foreground so the mark
// reads on light and dark themes alike.
Item {
  id: mark

  property real size: 16
  property color outline: "#1e1e1e"
  property color blue: "#31bef9"
  property color yellow: "#ffd541"
  property color red: "#ff4141"
  property bool idle: false
  property string badge: ""
  property color badgeColor: "transparent"
  property color badgeRing: "transparent"

  width: size
  height: size
  implicitWidth: size
  implicitHeight: size

  Shape {
    id: shape
    width: 98
    height: 98
    preferredRendererType: Shape.CurveRenderer
    opacity: mark.idle ? 0.72 : 1
    Behavior on opacity { NumberAnimation { duration: Style.duration(180); easing.type: Easing.OutCubic } }
    // Move the SVG viewBox origin (100, 66) to (0, 0), then scale 98 units to `size`.
    transform: [
      Translate { x: -100; y: -66 },
      Scale { xScale: mark.size / 98; yScale: mark.size / 98 }
    ]

    ShapePath {
      strokeWidth: -1
      fillColor: mark.blue
      PathSvg { path: "M133,149 L177,106 L160,89 L116,132 Z" }
    }
    ShapePath {
      strokeWidth: -1
      fillColor: mark.yellow
      PathSvg { path: "M128,114 L147,95 L128,76 L126,75 L123,76 L108,91 L107,93 L110,97 L127,114 Z" }
    }
    ShapePath {
      strokeWidth: -1
      fillColor: mark.yellow
      PathSvg { path: "M151,137 L170,118 L189,137 L190,140 L189,142 L186,146 L173,157 L170,157 Z" }
    }
    ShapePath {
      strokeWidth: -1
      fillColor: mark.red
      PathSvg { path: "M166,83l16,16l4-3l2-5v-4c0,0-1-2-1-3s-3-4-3-4l-5-3h-3h-3l-3,2l-2,2L166,83L166,83z" }
    }
    ShapePath {
      strokeWidth: -1
      fillColor: mark.outline
      PathSvg { path: "M126.7,115.5l1.7-1.7l-2.2-2.2l4.3-4.3c0.5-0.5,0.4-1.3-0.1-1.7c-0.5-0.4-1.2-0.4-1.7,0l-4.3,4.3l-4.1-4.1 l4.3-4.3c0.5-0.5,0.4-1.3-0.1-1.7c-0.5-0.4-1.2-0.4-1.7,0l-4.3,4.3l-4.1-4.1l9.4-9.5c0.5-0.5,0.4-1.3-0.1-1.7 c-0.5-0.4-1.2-0.4-1.7,0l-9.5,9.5l-3.6-3.6c-0.8-0.8-0.8-2,0-2.8L123.9,77c0.8-0.8,2-0.8,2.8,0L146,96.2l1.7-1.7l-19.2-19.2 c-1.7-1.7-4.6-1.7-6.3,0L107.5,90c-1.7,1.7-1.7,4.6,0,6.3L126.7,115.5z" }
    }
    ShapePath {
      strokeWidth: -1
      fillColor: mark.outline
      PathSvg { path: "M182.7,100.8l3-3c5-5.1,4.9-13.3-0.2-18.3c-5-5-13.1-5-18.2,0l-51.9,51.9c-0.1,0.1-0.2,0.2-0.2,0.4v0.1 l-7.2,23.8c-0.2,0.6,0.2,1.3,0.8,1.5c0.2,0.1,0.5,0.1,0.7,0l23.8-7.2h0.1c0.1-0.1,0.2-0.1,0.4-0.2L182.7,100.8L182.7,100.8z M159.3,91l6.6,6.6l-41.3,41.3l-6.6-6.6L159.3,91z M110.9,154.2l1-3.5c1.1,0.5,2,1.3,2.5,2.4L110.9,154.2z M116.9,152.4 c-0.8-1.8-2.4-3.2-4.2-4l4.2-13.9l13.7,13.7L116.9,152.4z M132.9,147.1l-6.6-6.6l41.3-41.3l6.6,6.6L132.9,147.1z M175.9,104.1 l-7.4-7.4l-7.4-7.4l4.2-4.2l14.9,14.9L175.9,104.1z M167,83.3l2.1-2.1c4.3-4,10.9-3.7,14.9,0.6c3.7,4,3.7,10.3,0,14.3l-2.1,2.1 L167,83.3z" }
    }
    ShapePath {
      strokeWidth: -1
      fillColor: mark.outline
      PathSvg { path: "M189.9,136.7l-19.2-19.2l-1.7,1.7l19.2,19.2c0.8,0.8,0.8,2,0,2.8l-14.7,14.7c-0.8,0.8-2.1,0.8-2.8,0l-3.6-3.6 l9.5-9.5c0.5-0.4,0.6-1.2,0.2-1.7c-0.4-0.5-1.2-0.6-1.7-0.2c-0.1,0.1-0.1,0.1-0.2,0.2l-9.5,9.5l-4.1-4.1l4.3-4.3 c0.5-0.5,0.5-1.2,0.1-1.7c-0.5-0.5-1.2-0.5-1.7-0.1c0,0,0,0-0.1,0.1l-4.3,4.3l-4.1-4.1l4.3-4.3c0.5-0.5,0.4-1.3-0.1-1.7 c-0.5-0.4-1.2-0.4-1.7,0l-4.3,4.3l-2.2-2.2l-1.8,1.7l19.2,19.2c1.7,1.7,4.6,1.7,6.3,0l14.7-14.7 C191.6,141.3,191.6,138.4,189.9,136.7C189.9,136.7,189.9,136.7,189.9,136.7z" }
    }
  }

  Rectangle {
    visible: mark.badge !== ""
    width: Math.max(4, mark.size * 0.36)
    height: width
    radius: width / 2
    x: mark.size - width * 0.8
    y: mark.size - width * 0.8
    color: mark.badgeColor
    border.width: Math.max(1, mark.size * 0.07)
    border.color: mark.badgeRing
  }
}

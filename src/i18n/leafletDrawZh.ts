import L from 'leaflet'

export function applyLeafletDrawZh() {
  ;(L as typeof L & { drawLocal: typeof L.drawLocal }).drawLocal = {
    draw: {
      toolbar: {
        actions: {
          title: '取消绘制',
          text: '取消',
        },
        finish: {
          title: '完成绘制',
          text: '完成',
        },
        undo: {
          title: '删除上一个点',
          text: '删除上一个点',
        },
        buttons: {
          polyline: '绘制折线',
          polygon: '绘制多边形',
          rectangle: '绘制矩形',
          circle: '绘制圆形',
          marker: '绘制标记',
          circlemarker: '绘制圆点标记',
        },
      },
      handlers: {
        circle: {
          tooltip: {
            start: '点击并拖动以绘制圆形。',
          },
          radius: '半径',
        },
        circlemarker: {
          tooltip: {
            start: '点击地图放置圆点标记。',
          },
        },
        marker: {
          tooltip: {
            start: '点击地图放置标记。',
          },
        },
        polygon: {
          tooltip: {
            start: '点击开始绘制形状。',
            cont: '点击继续绘制形状。',
            end: '点击第一个点以闭合形状。',
          },
        },
        polyline: {
          error: '<strong>错误：</strong>形状边线不能交叉！',
          tooltip: {
            start: '点击开始绘制线条。',
            cont: '点击继续绘制线条。',
            end: '点击最后一个点以完成线条。',
          },
        },
        rectangle: {
          tooltip: {
            start: '点击并拖动以绘制矩形。',
          },
        },
        simpleshape: {
          tooltip: {
            end: '松开鼠标以完成绘制。',
          },
        },
      },
    },
    edit: {
      toolbar: {
        actions: {
          save: {
            title: '保存更改',
            text: '保存',
          },
          cancel: {
            title: '取消编辑，放弃所有更改',
            text: '取消',
          },
          clearAll: {
            title: '清除所有图层',
            text: '全部清除',
          },
        },
        buttons: {
          edit: '编辑图层',
          editDisabled: '没有可编辑的图层',
          remove: '删除图层',
          removeDisabled: '没有可删除的图层',
        },
      },
      handlers: {
        edit: {
          tooltip: {
            text: '拖动手柄或标记以编辑要素。',
            subtext: '点击取消以撤销更改。',
          },
        },
        remove: {
          tooltip: {
            text: '点击要素以删除。',
          },
        },
      },
    },
  }
}
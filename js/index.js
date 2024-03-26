(function () {
  const GRID_SIZE = 9;
  const WAIT_FOR = 50;

  class Sudoku {
    id = null;
    grid = null;
    visualGrid = null;
    el = null;
    interval = null;
    isGameStarted = false;
    isFinished = false;
    history = [];
    minValue = {
      value: null,
      coords: [],
    };
    success = 0;
    failed = 0;
    popHist = 0;
    prev = null;

    constructor(el) {
      this.id = __uuid();
      if (typeof el === "string") {
        if (!el.startsWith("#")) el = "#" + el;
        this.el = document.querySelector(el);
      }
      if (!this.el) {
        throw "Failed to initialize sudoku area";
      }
      if (!this.el.classList.contains("sudoku")) {
        this.el.classList.add("sudoku");
      }
      this.el.dataset["id"] = this.id;

      const wrap = document.createElement("div");
      wrap.classList.add("sudoku-container");

      for (var i = 0; i < 3; i++) {
        for (var j = 0; j < 3; j++) {
          const box = document.createElement("div");
          box.classList.add("sudoku-box");
          for (var y = 0; y < 3; y++) {
            for (var x = 0; x < 3; x++) {
              const item = document.createElement("div");
              item.classList.add("sudoku-item");
              item.dataset.i = i * 3 + y;
              item.dataset.j = j * 3 + x;
              item.addEventListener("click", () => {
                if (!this.isGameStarted || this.isFinished) return;
                const i = item.dataset.i;
                const j = item.dataset.j;
                var wave = this.grid[i][j];
                if (wave.isFixed) return;
                var v = prompt("Please input value (1 ~ 9)");
                if (wave.isCollapsed) {
                  __undo(this, i, j);
                }
                if (v) {
                  try {
                    this.collapse(i, j, parseInt(v));
                  } catch (e) {
                    alert(e);
                  }
                } else {
                  __render(this);
                }
              });
              box.appendChild(item);
            }
          }
          wrap.append(box);
        }
      }
      this.el.append(wrap);
    }

    newGame(max = 10) {
      this.closeGame();
      __init_sudoku.apply(this);
      for (var i = 0; i < max; ) {
        var coords = __random_coords();
        var wave = this.grid[coords[0]][coords[1]];
        if (!wave.isCollapsed) {
          var index = parseInt(Math.random() * wave.statusList.length);
          var value = wave.statusList[index];
          this.collapse(coords[0], coords[1], value, true);
          i++;
        }
      }
      __update_min(this);
      this.isGameStarted = true;
    }

    closeGame() {
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
      }
      this.grid = null;
      this.visualGrid = null;
      this.isGameStarted = false;
      this.isFinished = false;
      this.history = [];
      this.popHist = 0;
      this.prev = null;
      const items = this.el.querySelectorAll(".sudoku-item");
      if (this.onstop) this.onstop(this);
      if (items) {
        Object.values(items).forEach((item) => (item.innerHTML = ""));
      }
    }

    auto() {
      if (!this.isGameStarted) return;
      requestAnimationFrame((t) => this.next(t));
    }

    redo() {
      if (!this.isGameStarted) return;
      __restore(this);
    }

    next(t) {
      if (!this.isGameStarted) return;
      if (this.prev === null) {
        this.prev = t;
        requestAnimationFrame((t) => this.next(t));
        return;
      } else if (t - this.prev < WAIT_FOR) {
        requestAnimationFrame((t) => this.next(t));
        return;
      }
      if (!this.isFinished && this.minValue.value === null) {
        var hist = __restore(this);
        if (!hist) {
          console.error("Failed");
          ++this.failed;
          this.isFinished = true;
          if (this.onstop) this.onstop(this);
        } else {
          this.prev = t;
          requestAnimationFrame((t) => this.next(t));
        }
      } else if (this.isFinished) {
        console.info("Success");
        ++this.success;
        this.isFinished = true;
        if (this.onstop) this.onstop(this);
      } else {
        var coords = this.minValue.coords[0];
        var wave = this.grid[coords[0]][coords[1]];
        var index = parseInt(Math.random() * wave.statusList.length);
        var value = wave.statusList[index];
        try {
          this.collapse(coords[0], coords[1], value);
          this.prev = t;
          requestAnimationFrame((t) => this.next(t));
        } catch (e) {
          console.error(e);
          var hist = __restore(this);
          if (!hist) {
            console.error("Failed");
            ++this.failed;
            this.isFinished = true;
            if (this.onstop) this.onstop(this);
          } else {
            this.prev = t;
            requestAnimationFrame((t) => this.next(t));
          }
        }
      }
    }

    collapse(i, j, value, fixed) {
      if (value === null) return;
      var wave = this.grid[i][j];
      var statusList = Object.assign(wave.statusList);
      if (!wave.collapsable(value))
        throw `Unable to collapse to value ${value}`;
      wave.collapse(value, fixed);
      __propagate(this, i, j, value);
      this.visualGrid[i][j] = value;
      __update_min(this);
      if (!fixed) {
        var item = {
          i,
          j,
          value: wave.value,
          statusList,
        };
        this.history.unshift(item);
      }
      if (!__render(this)) throw "Failed";
    }

    dispose() {
      if (this.el) {
        this.el.innerHTML = "";
        delete this.el.dataset.id;
        this.el.classList.remove("sudoku");
      }
    }
  }

  class WaveStatus {
    value = null;
    statusList = [];
    isCollapsed = false;
    isFixed = false;

    constructor() {
      this.statusList = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    }

    collapse(value, fixed) {
      this.value = value;
      this.statusList = [];
      this.isCollapsed = true;
      this.isFixed = fixed || false;
    }

    collapsable(value) {
      if (this.isFixed) return false;
      return this.statusList.includes(value);
    }

    ext(value) {
      if (this.statusList.includes(value)) {
        this.statusList.splice(this.statusList.indexOf(value), 1);
      }
    }

    add(value) {
      if (!this.statusList.includes(value)) {
        this.statusList.push(value);
      }
    }
  }

  function __init_sudoku() {
    this.grid = [];
    this.visualGrid = [];
    for (var i = 0; i < GRID_SIZE; i++) {
      var array = [];
      var visual = new Array(GRID_SIZE);
      visual.fill(null);
      for (var j = 0; j < GRID_SIZE; j++) {
        array.push(new WaveStatus());
      }
      this.grid.push(array);
      this.visualGrid.push(visual);
    }
  }

  function __propagate(vm, i, j, value) {
    for (var t = 0; t < GRID_SIZE; t++) {
      vm.grid[t][j].ext(value);
      vm.grid[i][t].ext(value);
    }
    var offset = __offset(i, j);
    for (var y = 0; y < 3; y++) {
      for (var x = 0; x < 3; x++) {
        vm.grid[offset[0] * 3 + y][offset[1] * 3 + x].ext(value);
      }
    }
  }

  function __unpropagate(vm, i, j, value) {
    for (var t = 0; t < GRID_SIZE; t++) {
      vm.grid[t][j].add(value);
      vm.grid[i][t].add(value);
    }
    var offset = __offset(i, j);
    for (var y = 0; y < 3; y++) {
      for (var x = 0; x < 3; x++) {
        vm.grid[offset[0] + y][offset[1] + x].add(value);
      }
    }
  }

  function __undo(vm, i, j) {
    var wave = vm.grid[i][j];
    if (wave.isFixed) return;
    wave.isCollapsed = false;
    wave.value = null;
    wave.statusList = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    __reset(vm);
  }

  function __reset(vm) {
    for (var i = 0; i < GRID_SIZE; i++) {
      for (var j = 0; j < GRID_SIZE; j++) {
        var wave = vm.grid[i][j];
        if (!wave.isCollapsed) {
          ___recalc_status(vm, wave, i, j);
        }
      }
    }
  }

  function ___recalc_status(vm, wave, i, j) {
    wave.statusList = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    var value;
    for (var t = 0; t < GRID_SIZE; t++) {
      value = vm.grid[t][j].value;
      if (value) wave.ext(value);
      value = vm.grid[i][t].value;
      if (value) wave.ext(value);
    }
    var offset = __offset(i, j);
    for (var y = 0; y < 3; y++) {
      for (var x = 0; x < 3; x++) {
        value = vm.grid[offset[0] * 3 + y][offset[1] * 3 + x];
        if (value) wave.ext(value);
      }
    }
  }

  function __restore(vm, force) {
    var hist = vm.history.shift();
    if (++vm.popHist > 100) return null;
    if (hist) {
      var wave = vm.grid[hist.i][hist.j];
      wave.isCollapsed = false;
      wave.value = null;
      wave.statusList = Object.assign(hist.statusList);
      __unpropagate(vm, hist.i, hist.j, hist.value);
      wave.ext(hist.value);
      __update_min(vm);
      __render(vm);
      if (force) return hist;
      return hist.statusList.length === 1 ? __restore(vm) : hist;
    } else return null;
  }

  function __random_coords(seeds) {
    if (seeds && seeds.length > 0) {
      var index = parseInt(Math.random() * seeds.length);
      return seeds[index];
    } else {
      var i = parseInt(Math.random() * GRID_SIZE);
      var j = parseInt(Math.random() * GRID_SIZE);
      return [i, j];
    }
  }

  function __offset(i, j) {
    var y = parseInt(Math.floor(i / 3));
    var x = parseInt(Math.floor(j / 3));
    return [y, x];
  }

  function __uuid() {
    return URL.createObjectURL(new Blob()).slice(-36);
  }

  function __update_min(vm) {
    vm.minValue = {
      value: null,
      coords: [],
    };
    vm.isFinished = true;
    for (var i = 0; i < GRID_SIZE; i++) {
      for (var j = 0; j < GRID_SIZE; j++) {
        vm.isFinished = vm.isFinished && vm.grid[i][j].isCollapsed;
        var value = vm.grid[i][j].statusList.length;
        if (value === 0) continue;
        if (vm.minValue.value === null) {
          vm.minValue.value = value;
          vm.minValue.coords = [[i, j]];
        } else if (vm.minValue.value === value) {
          vm.minValue.coords.push([i, j]);
        } else if (vm.minValue.value > value) {
          vm.minValue.value = value;
          vm.minValue.coords = [[i, j]];
        }
      }
    }
  }

  function __render(vm) {
    var error = false;
    for (var i = 0; i < GRID_SIZE; i++) {
      for (var j = 0; j < GRID_SIZE; j++) {
        wave = vm.grid[i][j];
        var el = vm.el.querySelector(`[data-i="${i}"][data-j="${j}"]`);
        if (!wave.isCollapsed && wave.statusList.length === 0) {
          error = true;
        }
        if (!el) continue;
        if (wave.isCollapsed) {
          el.innerHTML = `<span>${wave.value}</span>`;
        } else {
          el.innerHTML = wave.statusList.map((e) => `<em>${e}</em>`).join("");
        }
      }
    }
    return !error;
  }

  window.Sudoku = Sudoku;
})();

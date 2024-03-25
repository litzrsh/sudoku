(function () {
  const GRID_SIZE = 9;

  class Sudoku {
    id = null;
    grid = null;
    visualGrid = null;
    el = null;
    interval = null;
    isGameStarted = false;
    isFinished = false;
    minValue = {
      value: null,
      coords: [],
    };

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
              box.appendChild(item);
            }
          }
          wrap.append(box);
        }
      }
      this.el.append(wrap);
    }

    newGame() {
      this.closeGame();
      __init_sudoku.apply(this);
      for (var i = 0; i < 10; ) {
        var coords = __random_coords();
        var wave = this.grid[coords[0]][coords[1]];
        if (!wave.isCollapsed) {
          var index = parseInt(Math.random() * wave.statusList.length);
          var value = wave.statusList[index];
          this.collapse(coords[0], coords[1], value, true);
          i++;
        }
      }
      __update_min.apply(this);
      this.isGameStarted = true;
      this.interval = setInterval(() => {
        if (!this.isFinished && this.minValue.value === null) {
          alert("Invalid solve");
          clearInterval(this.interval);
          this.interval = null;
          this.isFinished = true;
        } else if (this.isFinished) {
          alert("Finished");
          clearInterval(this.interval);
          this.interval = null;
        } else {
          var coords = this.minValue.coords[0];
          var wave = this.grid[coords[0]][coords[1]];
          var index = parseInt(Math.random() * wave.statusList.length);
          var value = wave.statusList[index];
          try {
            this.collapse(coords[0], coords[1], value);
          } catch (e) {
            alert(e);
            clearInterval(this.interval);
            this.interval = null;
            this.isFinished = true;
          }
        }
      }, 1000);
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
      const items = this.el.querySelectorAll(".sudoku-item");
      if (items) {
        Object.values(items).forEach((item) => (item.innerHTML = ""));
      }
    }

    collapse(i, j, value, fixed) {
      var wave = this.grid[i][j];
      if (!wave.collapsable(value))
        throw `Unable to collapse to value ${value}`;
      wave.collapse(value, fixed);
      __propagate.apply(this, [i, j, value]);
      this.visualGrid[i][j] = value;
      __update_min.apply(this);
      for (var i = 0; i < GRID_SIZE; i++) {
        for (var j = 0; j < GRID_SIZE; j++) {
          wave = this.grid[i][j];
          var el = this.el.querySelector(`[data-i="${i}"][data-j="${j}"]`);
          if (!el) continue;
          if (!wave.isCollapsed && wave.statusList.length === 0)
            throw "Invalid solve";
          if (wave.isCollapsed) {
            el.innerHTML = `<span>${wave.value}</span>`;
          } else {
            el.innerHTML = wave.statusList.map((e) => `<em>${e}</em>`).join("");
          }
        }
      }
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
      this.statusList = this.statusList.filter((v) => v !== value);
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

  function __propagate(i, j, value) {
    for (var t = 0; t < GRID_SIZE; t++) {
      this.grid[t][j].ext(value);
      this.grid[i][t].ext(value);
    }
    var offset = __offset(i, j);
    for (var y = 0; y < 3; y++) {
      for (var x = 0; x < 3; x++) {
        this.grid[offset[0] + y][offset[1] + x].ext(value);
      }
    }
  }

  function __is_valid(value) {
    if (typeof value !== "number") return false;
    if (isNaN(value)) return false;
    return value > 0 && value < GRID_SIZE;
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

  function __update_min() {
    this.minValue = {
      value: null,
      coords: [],
    };
    this.isFinished = true;
    for (var i = 0; i < GRID_SIZE; i++) {
      for (var j = 0; j < GRID_SIZE; j++) {
        this.isFinished = this.isFinished && this.grid[i][j].isCollapsed;
        var value = this.grid[i][j].statusList.length;
        if (value === 0) continue;
        if (this.minValue.value === null) {
          this.minValue.value = value;
          this.minValue.coords = [[i, j]];
        } else if (this.minValue.value === value) {
          this.minValue.coords.push([i, j]);
        } else if (this.minValue.value > value) {
          this.minValue.value = value;
          this.minValue.coords = [[i, j]];
        }
      }
    }
    console.log(this.minValue);
  }

  window.Sudoku = Sudoku;
})();

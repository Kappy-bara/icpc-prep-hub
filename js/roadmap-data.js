/**
 * Roadmap content: subjects -> phases (Foundations/Core/Advanced) -> topics.
 * Each topic: { id, name, why, resource: { label, url } | null }
 * `id` must be globally unique (subject.topic-slug) since it's the localStorage key for checkbox state.
 */
const ROADMAP = [
  {
    id: "math",
    name: "Math & Number Theory",
    blurb: "Modular arithmetic, combinatorics, and the algebraic tools that show up in nearly every contest.",
    phases: [
      {
        name: "Foundations",
        topics: [
          {
            id: "math.modular-arithmetic",
            name: "Modular arithmetic & fast exponentiation",
            why: "Almost every counting or DP answer must be reduced mod 1e9+7 — fast exponentiation (and modular inverse) makes that reduction possible in O(log n).",
            resource: { label: "cp-algorithms: Binary Exponentiation", url: "https://cp-algorithms.com/algebra/binary-exp.html" },
          },
          {
            id: "math.gcd-extended-euclid",
            name: "GCD, LCM & Extended Euclid",
            why: "Extended Euclid gives you modular inverses and solves linear Diophantine equations — a building block for half of number theory.",
            resource: { label: "cp-algorithms: Extended Euclidean Algorithm", url: "https://cp-algorithms.com/algebra/extended-euclid-algorithm.html" },
          },
          {
            id: "math.sieve-factorization",
            name: "Sieve of Eratosthenes & prime factorization",
            why: "Precomputing primes/factorizations in O(n log log n) turns \"is this prime?\" from a bottleneck into a non-issue.",
            resource: { label: "cp-algorithms: Sieve of Eratosthenes", url: "https://cp-algorithms.com/algebra/sieve-of-eratosthenes.html" },
          },
          {
            id: "math.basic-combinatorics",
            name: "Combinatorics basics (permutations, combinations, Pascal's triangle)",
            why: "Counting arrangements and selections is one of the most common Div2 B/C problem shapes.",
            resource: { label: "cp-algorithms: Binomial Coefficients", url: "https://cp-algorithms.com/combinatorics/binomial-coefficients.html" },
          },
        ],
      },
      {
        name: "Core",
        topics: [
          {
            id: "math.modular-combinatorics",
            name: "Modular combinatorics (factorial precompute, nCr mod p)",
            why: "O(n) precompute then O(1) nCr mod p is a building block you'll reuse in dozens of problems.",
            resource: { label: "cp-algorithms: Factorial modulo p", url: "https://cp-algorithms.com/algebra/factorial-modulo.html" },
          },
          {
            id: "math.inclusion-exclusion",
            name: "Inclusion-exclusion principle",
            why: "Counts \"at least one property holds\" by adding and subtracting overlapping cases — the standard tool behind derangements, coprime-counting, and constraint-violation counting problems.",
            resource: { label: "cp-algorithms: The Inclusion-Exclusion Principle", url: "https://cp-algorithms.com/combinatorics/inclusion-exclusion.html" },
          },
          {
            id: "math.crt",
            name: "Chinese Remainder Theorem",
            why: "Combines several modular constraints into one — shows up whenever a problem gives you multiple \"x ≡ a (mod m)\" facts.",
            resource: { label: "cp-algorithms: Chinese Remainder Theorem", url: "https://cp-algorithms.com/algebra/chinese-remainder-theorem.html" },
          },
          {
            id: "math.totient",
            name: "Euler's totient & multiplicative functions",
            why: "Counting coprime pairs and divisor-sum problems almost always route through phi or a related multiplicative function.",
            resource: { label: "cp-algorithms: Euler's totient function", url: "https://cp-algorithms.com/algebra/phi-function.html" },
          },
          {
            id: "math.probability-ev",
            name: "Probability & expected value (linearity of expectation)",
            why: "Linearity of expectation lets you sum the expectations of simple sub-events instead of modeling an entire complex process.",
            resource: { label: "Competitive Programmer's Handbook (CSES)", url: "https://cses.fi/book/book.pdf" },
          },
          {
            id: "math.matrix-exponentiation",
            name: "Matrix exponentiation",
            why: "Turns an O(n) linear recurrence (Fibonacci-like DP) into O(log n) by expressing the transition as a matrix power.",
            resource: { label: "cp-algorithms: Binary Exponentiation", url: "https://cp-algorithms.com/algebra/binary-exp.html" },
          },
          {
            id: "math.game-theory-nim",
            name: "Game theory: Nim & Sprague-Grundy",
            why: "Reduces a huge class of impartial two-player games to computing one XOR of Grundy numbers.",
            resource: { label: "cp-algorithms: Sprague-Grundy theorem, Nim", url: "https://cp-algorithms.com/game_theory/sprague-grundy-nim.html" },
          },
        ],
      },
      {
        name: "Advanced",
        topics: [
          {
            id: "math.fft-ntt",
            name: "FFT / NTT (fast polynomial multiplication)",
            why: "Multiplies two polynomials (or computes a big convolution) in O(n log n) instead of the naive O(n²), unlocking a whole class of counting problems.",
            resource: { label: "cp-algorithms: Fast Fourier transform", url: "https://cp-algorithms.com/algebra/fft.html" },
          },
          {
            id: "math.generating-functions",
            name: "Generating functions",
            why: "Recasts combinatorial recurrences as algebra on power series, so you can extract a coefficient instead of hand-deriving a recurrence.",
            resource: { label: "Competitive Programmer's Handbook (CSES)", url: "https://cses.fi/book/book.pdf" },
          },
          {
            id: "math.xor-basis",
            name: "Linear algebra over GF(2) / XOR basis",
            why: "The standard tool for \"maximum XOR subset\" and testing linear independence of a set of numbers (same Gaussian-elimination idea, applied over GF(2)).",
            resource: { label: "cp-algorithms: Gauss & System of Linear Equations", url: "https://cp-algorithms.com/linear_algebra/linear-system-gauss.html" },
          },
          {
            id: "math.mobius",
            name: "Möbius function & multiplicative-function sums",
            why: "Powers advanced divisor-sum and gcd-counting problems that show up at Div1 D+ / World Finals level.",
            resource: { label: "cp-algorithms: Number of divisors / sum of divisors", url: "https://cp-algorithms.com/algebra/divisors.html" },
          },
        ],
      },
    ],
  },
  {
    id: "ds",
    name: "Data Structures",
    blurb: "From arrays and DSU up through segment trees and persistent structures.",
    phases: [
      {
        name: "Foundations",
        topics: [
          {
            id: "ds.stl-basics",
            name: "C++ STL essentials (vector, pair, set/map, sort & built-in algorithms)",
            why: "Contest code lives and dies by fluent STL use — knowing which container or <algorithm> call to reach for turns a 20-line manual implementation into one line.",
            resource: { label: "USACO Guide: Introduction to Data Structures", url: "https://usaco.guide/bronze/intro-ds" },
          },
          {
            id: "ds.arrays-prefix-sums",
            name: "Arrays, prefix sums & difference arrays",
            why: "O(1) range-sum and range-update after O(n) prep is the cheapest speedup you'll ever add to a solution.",
            resource: { label: "USACO Guide: Prefix Sums", url: "https://usaco.guide/silver/prefix-sums" },
          },
          {
            id: "ds.stacks-queues-monotonic",
            name: "Stacks, queues & monotonic stack/queue",
            why: "Linear-time solutions to \"next greater element\" and sliding-window-minimum problems, where the naive approach is O(n²).",
            resource: { label: "cp-algorithms: Minimum Stack / Minimum Queue", url: "https://cp-algorithms.com/data_structures/stack_queue_modification.html" },
          },
          {
            id: "ds.priority-queue",
            name: "Priority queue / heap",
            why: "The default structure whenever you need repeated access to the current min/max — Dijkstra, Huffman-style greedy, and k-way merge all build on it.",
            resource: { label: "USACO Guide: Priority Queues", url: "https://usaco.guide/silver/priority-queues" },
          },
          {
            id: "ds.dsu",
            name: "Disjoint Set Union (DSU)",
            why: "Near-O(1) amortized connectivity queries — the backbone of Kruskal's MST and countless offline graph tricks.",
            resource: { label: "cp-algorithms: Disjoint Set Union", url: "https://cp-algorithms.com/data_structures/disjoint_set_union.html" },
          },
        ],
      },
      {
        name: "Core",
        topics: [
          {
            id: "ds.fenwick",
            name: "Binary Indexed Tree (Fenwick tree)",
            why: "A compact O(log n) structure for prefix sums with point updates — shorter and less error-prone to code under contest pressure than a segment tree.",
            resource: { label: "cp-algorithms: Fenwick Tree", url: "https://cp-algorithms.com/data_structures/fenwick.html" },
          },
          {
            id: "ds.segment-tree",
            name: "Segment tree (range query, point update)",
            why: "The single most reusable data structure in competitive programming — range min/max/sum/gcd with point updates.",
            resource: { label: "cp-algorithms: Segment Tree", url: "https://cp-algorithms.com/data_structures/segment_tree.html" },
          },
          {
            id: "ds.lazy-propagation",
            name: "Lazy propagation (range updates on segment trees)",
            why: "Defers pending range updates onto child nodes only when needed, turning O(n) range updates into O(log n) — without it, a segment tree only supports point updates.",
            resource: { label: "cp-algorithms: Segment Tree", url: "https://cp-algorithms.com/data_structures/segment_tree.html" },
          },
          {
            id: "ds.sparse-table",
            name: "Sparse tables (RMQ)",
            why: "O(1) answers to idempotent range queries (min/max/gcd) on a static array after O(n log n) preprocessing.",
            resource: { label: "cp-algorithms: Sparse Table", url: "https://cp-algorithms.com/data_structures/sparse-table.html" },
          },
          {
            id: "ds.ordered-set",
            name: "Ordered set / order statistics (PBDS)",
            why: "Answers \"k-th smallest\" and \"rank of x\" queries in O(log n) — a frequent need a plain set/map can't give you.",
            resource: { label: "Competitive Programmer's Handbook (CSES)", url: "https://cses.fi/book/book.pdf" },
          },
          {
            id: "ds.sqrt-decomp-mo",
            name: "Sqrt decomposition & Mo's algorithm",
            why: "A general-purpose O((n+q)√n) fallback for range problems that resist a clean segment-tree structure.",
            resource: { label: "cp-algorithms: Sqrt Decomposition", url: "https://cp-algorithms.com/data_structures/sqrt_decomposition.html" },
          },
        ],
      },
      {
        name: "Advanced",
        topics: [
          {
            id: "ds.persistent-segtree",
            name: "Persistent segment trees",
            why: "Lets you query every historical version of an array — the standard trick for \"k-th smallest in a range, using only values up to some bound over time\".",
            resource: { label: "USACO Guide: Persistent Data Structures", url: "https://usaco.guide/plat/persistent" },
          },
          {
            id: "ds.segtree-beats",
            name: "Segment tree beats / advanced lazy tricks",
            why: "Handles range chmin/chmax-with-sum problems that plain lazy propagation can't express.",
            resource: { label: "USACO Guide: Advanced Segment Tree Techniques", url: "https://usaco.guide/adv/segtree-beats" },
          },
          {
            id: "ds.merge-sort-tree",
            name: "Merge sort tree / wavelet tree",
            why: "Offline range k-th-smallest and range-counting queries beyond what a plain segment tree can answer.",
            resource: { label: "Competitive Programmer's Handbook (CSES)", url: "https://cses.fi/book/book.pdf" },
          },
          {
            id: "ds.link-cut-tree",
            name: "Link-cut trees",
            why: "Rare, but decisive for dynamic-tree connectivity/path problems that occasionally appear at World Finals level.",
            resource: { label: "Competitive Programmer's Handbook (CSES)", url: "https://cses.fi/book/book.pdf" },
          },
        ],
      },
    ],
  },
  {
    id: "graphs",
    name: "Graphs",
    blurb: "Traversal, shortest paths, connectivity, and flow/matching.",
    phases: [
      {
        name: "Foundations",
        topics: [
          {
            id: "graphs.bfs-dfs",
            name: "BFS/DFS & connected components",
            why: "The traversal every other graph algorithm is built on top of.",
            resource: { label: "cp-algorithms: Breadth First Search", url: "https://cp-algorithms.com/graph/breadth-first-search.html" },
          },
          {
            id: "graphs.tree-basics",
            name: "Tree basics (rooting, DFS order, diameter)",
            why: "Rooting a tree and computing DFS in/out times and diameter are the building blocks every tree-DP and tree-query technique below assumes you already have.",
            resource: { label: "USACO Guide: Introduction to Tree Algorithms", url: "https://usaco.guide/silver/intro-tree" },
          },
          {
            id: "graphs.topo-sort",
            name: "Topological sort",
            why: "Orders tasks by dependency — a prerequisite for almost all DAG dynamic programming.",
            resource: { label: "cp-algorithms: Topological Sorting", url: "https://cp-algorithms.com/graph/topological-sort.html" },
          },
          {
            id: "graphs.dijkstra",
            name: "Dijkstra's algorithm",
            why: "The default shortest-path algorithm whenever edge weights are non-negative.",
            resource: { label: "cp-algorithms: Dijkstra", url: "https://cp-algorithms.com/graph/dijkstra.html" },
          },
        ],
      },
      {
        name: "Core",
        topics: [
          {
            id: "graphs.bellman-ford",
            name: "Bellman-Ford (negative weights, cycle detection)",
            why: "Handles negative edge weights and detects negative cycles, which Dijkstra silently gets wrong on.",
            resource: { label: "cp-algorithms: Bellman-Ford", url: "https://cp-algorithms.com/graph/bellman_ford.html" },
          },
          {
            id: "graphs.floyd-warshall",
            name: "Floyd-Warshall (all-pairs shortest paths)",
            why: "A simple O(n³) all-pairs solution that's hard to beat for small, dense graphs.",
            resource: { label: "cp-algorithms: Floyd-Warshall", url: "https://cp-algorithms.com/graph/all-pair-shortest-path-floyd-warshall.html" },
          },
          {
            id: "graphs.01-bfs",
            name: "0-1 BFS & multi-source BFS",
            why: "A deque-based BFS variant that handles 0/1 edge weights in O(V+E), and multi-source BFS answers \"distance to the nearest of many sources\" without a separate run per source.",
            resource: { label: "cp-algorithms: 0-1 BFS", url: "https://cp-algorithms.com/graph/01_bfs.html" },
          },
          {
            id: "graphs.flow-basics",
            name: "Flow networks & Ford-Fulkerson / Edmonds-Karp",
            why: "Introduces residual graphs and augmenting paths — the mental model every faster max-flow algorithm (including Dinic's, below) builds on, and often fast enough on its own for regional-sized inputs.",
            resource: { label: "cp-algorithms: Ford-Fulkerson and Edmonds-Karp", url: "https://cp-algorithms.com/graph/edmonds_karp.html" },
          },
          {
            id: "graphs.mst",
            name: "Minimum spanning tree (Kruskal / Prim)",
            why: "A classic greedy-plus-DSU pattern that also underlies many \"connect everything at minimum total cost\" problems.",
            resource: { label: "cp-algorithms: MST - Kruskal", url: "https://cp-algorithms.com/graph/mst_kruskal.html" },
          },
          {
            id: "graphs.bridges-articulation",
            name: "Bridges & articulation points",
            why: "Finds the edges/vertices whose removal disconnects the graph — common in network-robustness problems.",
            resource: { label: "cp-algorithms: Finding Bridges", url: "https://cp-algorithms.com/graph/bridge-searching.html" },
          },
          {
            id: "graphs.scc",
            name: "Strongly connected components (Tarjan / Kosaraju)",
            why: "Condenses a directed graph into a DAG of SCCs, which you can then run DAG-DP over.",
            resource: { label: "cp-algorithms: Strongly Connected Components", url: "https://cp-algorithms.com/graph/strongly-connected-components.html" },
          },
          {
            id: "graphs.lca",
            name: "LCA with binary lifting",
            why: "O(log n) ancestor and distance queries on a tree power a huge share of tree-DP and tree-path problems.",
            resource: { label: "cp-algorithms: LCA - Binary Lifting", url: "https://cp-algorithms.com/graph/lca_binary_lifting.html" },
          },
          {
            id: "graphs.functional-graphs",
            name: "Functional graphs (successor graphs & cycle detection)",
            why: "Every node has exactly one outgoing edge (\"i points to f(i)\"), so the graph is just chains leading into cycles — the same binary-lifting idea from LCA answers \"where do I end up after k steps?\" in O(log k).",
            resource: { label: "USACO Guide: Introduction to Functional Graphs", url: "https://usaco.guide/silver/func-graphs" },
          },
          {
            id: "graphs.euler-path",
            name: "Euler path & circuit (Hierholzer's algorithm)",
            why: "Finds a walk that uses every edge exactly once — the classic \"draw this graph without lifting your pen\" problem, and a recurring ICPC set-piece.",
            resource: { label: "cp-algorithms: Finding the Eulerian path", url: "https://cp-algorithms.com/graph/euler_path.html" },
          },
        ],
      },
      {
        name: "Advanced",
        topics: [
          {
            id: "graphs.max-flow",
            name: "Max flow (Dinic's algorithm)",
            why: "A surprising number of \"hard\" ICPC problems are secretly a max-flow problem once you find the right model.",
            resource: { label: "cp-algorithms: Dinic's algorithm", url: "https://cp-algorithms.com/graph/dinic.html" },
          },
          {
            id: "graphs.mcmf",
            name: "Min-cost max-flow",
            why: "Extends flow modeling to problems with a cost objective, not just a feasibility/capacity one.",
            resource: { label: "cp-algorithms: Minimum-cost flow", url: "https://cp-algorithms.com/graph/min_cost_flow.html" },
          },
          {
            id: "graphs.bipartite-matching",
            name: "Bipartite matching (Kuhn's algorithm / Hopcroft-Karp)",
            why: "Assignment-style problems (match workers to jobs, etc.) appear constantly in regional-level sets.",
            resource: { label: "cp-algorithms: Kuhn's Maximum Bipartite Matching", url: "https://cp-algorithms.com/graph/kuhn_maximum_bipartite_matching.html" },
          },
          {
            id: "graphs.two-sat",
            name: "2-SAT",
            why: "Turns boolean-constraint problems (\"at least one of A or B must hold\") into an SCC computation you already know.",
            resource: { label: "cp-algorithms: 2-SAT", url: "https://cp-algorithms.com/graph/2SAT.html" },
          },
          {
            id: "graphs.hld",
            name: "Heavy-light decomposition",
            why: "Path queries and updates on a tree in O(log² n) — a World-Finals-tier technique built on top of segment trees.",
            resource: { label: "cp-algorithms: Heavy-light decomposition", url: "https://cp-algorithms.com/graph/hld.html" },
          },
          {
            id: "graphs.centroid-decomposition",
            name: "Centroid decomposition",
            why: "Recursively splits a tree at its centroid to answer path-counting/path-query problems in O(n log n) total — a staple of Div1 E/F tree problems.",
            resource: { label: "USACO Guide: Centroid Decomposition", url: "https://usaco.guide/plat/centroid" },
          },
          {
            id: "graphs.small-to-large",
            name: "Small-to-large merging (DSU on tree)",
            why: "Merges children's data into the larger sibling's structure each time, answering subtree-aggregate queries in O(n log n) instead of O(n²).",
            resource: { label: "USACO Guide: Small-To-Large Merging", url: "https://usaco.guide/plat/merging" },
          },
        ],
      },
    ],
  },
  {
    id: "dp",
    name: "Dynamic Programming",
    blurb: "From knapsack/LIS through bitmask, digit, and tree DP, up to advanced DP-speedup tricks.",
    phases: [
      {
        name: "Foundations",
        topics: [
          {
            id: "dp.recursion-backtracking",
            name: "Recursion & complete search (brute force, backtracking)",
            why: "Generating every permutation/subset/combination and pruning as you go is the baseline every DP is a faster version of — you can't recognize \"this state repeats\" until you've written the brute-force recursion first.",
            resource: { label: "USACO Guide: Complete Search with Recursion", url: "https://usaco.guide/bronze/complete-rec" },
          },
          {
            id: "dp.dp-basics",
            name: "1D/2D DP basics (knapsack, LIS, LCS)",
            why: "The vocabulary every other DP topic on this list is built from.",
            resource: { label: "cp-algorithms: Introduction to Dynamic Programming", url: "https://cp-algorithms.com/dynamic_programming/intro-to-dp.html" },
          },
          {
            id: "dp.interval-dp",
            name: "Interval / range DP",
            why: "Matrix-chain-multiplication-style DP (optimal split of a range) is a recurring Div2 D pattern.",
            resource: { label: "USACO Guide: Range DP", url: "https://usaco.guide/gold/dp-ranges" },
          },
        ],
      },
      {
        name: "Core",
        topics: [
          {
            id: "dp.bitmask-dp",
            name: "Bitmask DP",
            why: "Encodes a subset as state for small-n \"visit/assign everything\" problems like TSP.",
            resource: { label: "USACO Guide: Bitmask DP", url: "https://usaco.guide/gold/dp-bitmasks" },
          },
          {
            id: "dp.meet-in-the-middle",
            name: "Meet in the middle",
            why: "Splits an n-up-to-~40 brute force into two n/2 halves you can each enumerate in 2^(n/2) and combine — turns an infeasible 2^n search into a feasible one without any DP at all.",
            resource: { label: "USACO Guide: Meet In The Middle", url: "https://usaco.guide/gold/meet-in-the-middle" },
          },
          {
            id: "dp.digit-dp",
            name: "Digit DP",
            why: "Counts how many numbers up to N satisfy a digit-wise property, without enumerating every number.",
            resource: { label: "USACO Guide: Digit DP", url: "https://usaco.guide/plat/digit-dp" },
          },
          {
            id: "dp.tree-dp",
            name: "Tree DP",
            why: "Nearly every \"optimize something over a tree\" problem reduces to combining DP values from a node's children.",
            resource: { label: "USACO Guide: Tree DP", url: "https://usaco.guide/gold/tree-dp" },
          },
          {
            id: "dp.dp-ds-optimization",
            name: "DP optimized with a data structure (segment tree / BIT transitions)",
            why: "Speeds up an O(n²) transition to O(n log n) whenever the transition itself is a range max/min/sum query.",
            resource: { label: "USACO Guide: More Dynamic Programming", url: "https://usaco.guide/plat/dp-more" },
          },
        ],
      },
      {
        name: "Advanced",
        topics: [
          {
            id: "dp.sos-dp",
            name: "Sum over subsets (SOS) DP",
            why: "Computes, for every bitmask, an aggregate over all of its submasks in O(2^n · n) instead of the naive O(3^n) — the standard trick once bitmask DP transitions start summing over submasks.",
            resource: { label: "USACO Guide: Sum over Subsets DP", url: "https://usaco.guide/plat/dp-sos" },
          },
          {
            id: "dp.dc-optimization",
            name: "Divide & conquer DP optimization",
            why: "Collapses an O(n²) DP to O(n log n) whenever the optimal split point moves monotonically with the state.",
            resource: { label: "cp-algorithms: Divide and Conquer DP", url: "https://cp-algorithms.com/dynamic_programming/divide-and-conquer-dp.html" },
          },
          {
            id: "dp.cht",
            name: "Convex hull trick / Li Chao tree",
            why: "The standard way to optimize DP transitions shaped like min(dp[j] + b[j]·x) down to O(log n) per query.",
            resource: { label: "cp-algorithms: Convex hull trick and Li Chao tree", url: "https://cp-algorithms.com/geometry/convex_hull_trick.html" },
          },
          {
            id: "dp.knuth-opt",
            name: "Knuth's optimization",
            why: "Another O(n²) → O(n log n) DP speedup, applicable when the cost function satisfies the quadrangle inequality.",
            resource: { label: "cp-algorithms: Knuth's Optimization", url: "https://cp-algorithms.com/dynamic_programming/knuth-optimization.html" },
          },
          {
            id: "dp.slope-trick",
            name: "Slope trick",
            why: "Maintains a convex piecewise-linear cost function with a couple of heaps, solving \"minimize Σ|aᵢ − x|\"-style DPs in O(n log n).",
            resource: { label: "USACO Guide: Slope Trick", url: "https://usaco.guide/adv/slope-trick" },
          },
        ],
      },
    ],
  },
  {
    id: "strings",
    name: "Strings",
    blurb: "Hashing and pattern matching up through suffix structures.",
    phases: [
      {
        name: "Foundations",
        topics: [
          {
            id: "strings.string-hashing",
            name: "String hashing (polynomial rolling hash)",
            why: "Turns substring-equality checks into O(1) comparisons after O(n) preprocessing.",
            resource: { label: "cp-algorithms: String Hashing", url: "https://cp-algorithms.com/string/string-hashing.html" },
          },
          {
            id: "strings.kmp",
            name: "KMP / prefix function",
            why: "O(n+m) exact pattern matching, and the prefix function alone solves string-period problems.",
            resource: { label: "cp-algorithms: Prefix function - KMP", url: "https://cp-algorithms.com/string/prefix-function.html" },
          },
        ],
      },
      {
        name: "Core",
        topics: [
          {
            id: "strings.z-function",
            name: "Z-function",
            why: "An alternative to KMP that's often simpler to apply for substring-matching variants and string-comparison tricks.",
            resource: { label: "cp-algorithms: Z-function", url: "https://cp-algorithms.com/string/z-function.html" },
          },
          {
            id: "strings.trie",
            name: "Trie",
            why: "Prefix queries and XOR-trie tricks over a set of strings or numbers.",
            resource: { label: "USACO Guide: Trie", url: "https://usaco.guide/gold/trie" },
          },
          {
            id: "strings.manacher",
            name: "Manacher's algorithm",
            why: "Finds every palindromic substring in O(n), beating the naive O(n²) expand-around-center approach.",
            resource: { label: "cp-algorithms: Manacher's Algorithm", url: "https://cp-algorithms.com/string/manacher.html" },
          },
          {
            id: "strings.aho-corasick",
            name: "Aho-Corasick",
            why: "Matches many patterns against a text in one linear pass — the go-to when you're searching for a whole dictionary of keywords at once.",
            resource: { label: "cp-algorithms: Aho-Corasick algorithm", url: "https://cp-algorithms.com/string/aho_corasick.html" },
          },
        ],
      },
      {
        name: "Advanced",
        topics: [
          {
            id: "strings.suffix-array",
            name: "Suffix array + LCP array (Kasai's algorithm)",
            why: "Unlocks a huge class of substring-counting, comparison, and longest-common-substring problems.",
            resource: { label: "cp-algorithms: Suffix Array", url: "https://cp-algorithms.com/string/suffix-array.html" },
          },
          {
            id: "strings.suffix-automaton",
            name: "Suffix automaton",
            why: "A linear-size automaton over all substrings of a string — powerful for distinct-substring counting problems.",
            resource: { label: "cp-algorithms: Suffix Automaton", url: "https://cp-algorithms.com/string/suffix-automaton.html" },
          },
          {
            id: "strings.palindromic-tree",
            name: "Palindromic tree (eertree)",
            why: "A structure purpose-built for problems about distinct palindromic substrings.",
            resource: { label: "Competitive Programmer's Handbook (CSES)", url: "https://cses.fi/book/book.pdf" },
          },
        ],
      },
    ],
  },
  {
    id: "greedy",
    name: "Greedy & Sorting",
    blurb: "Sort-then-scan strategies and proving greedy correctness.",
    phases: [
      {
        name: "Foundations",
        topics: [
          {
            id: "greedy.sort-greedy",
            name: "Sorting-based greedy (interval scheduling, activity selection)",
            why: "A huge share of optimization problems fall to \"sort, then make one greedy pass\" — if you can prove the exchange argument.",
            resource: { label: "Codeforces EDU: courses", url: "https://codeforces.com/edu/courses" },
          },
          {
            id: "greedy.binary-search",
            name: "Binary search (on arrays & on the answer)",
            why: "Halves the search space every step — the classic form finds a value in a sorted array in O(log n), and \"binary search on the answer\" reuses the same idea to turn \"find the optimal x\" into repeatedly asking \"is x feasible?\".",
            resource: { label: "USACO Guide: Binary Search", url: "https://usaco.guide/silver/binary-search" },
          },
          {
            id: "greedy.two-pointers",
            name: "Two pointers",
            why: "Turns an O(n²) nested scan into O(n) whenever the search window only ever grows in one direction.",
            resource: { label: "USACO Guide: Two Pointers", url: "https://usaco.guide/silver/two-pointers" },
          },
          {
            id: "greedy.coordinate-compression",
            name: "Coordinate compression",
            why: "Replaces huge or sparse coordinate values with their sorted rank, so array-indexed structures (BITs, difference arrays) can be used on ranges like 1e9 as if they were size n.",
            resource: { label: "USACO Guide: Custom Comparators and Coordinate Compression", url: "https://usaco.guide/silver/sorting-custom" },
          },
        ],
      },
      {
        name: "Core",
        topics: [
          {
            id: "greedy.exchange-argument",
            name: "Exchange argument (proving greedy correctness)",
            why: "Contest judges won't accept \"it felt right\" — you need to prove your greedy strategy before trusting it under pressure.",
            resource: { label: "Competitive Programmer's Handbook (CSES)", url: "https://cses.fi/book/book.pdf" },
          },
          {
            id: "greedy.pq-greedy",
            name: "Priority-queue greedy (Huffman-style, deadline scheduling)",
            why: "A large class of greedy problems needs a heap to always grab the provably-best next choice.",
            resource: { label: "Competitive Programmer's Handbook (CSES)", url: "https://cses.fi/book/book.pdf" },
          },
        ],
      },
      {
        name: "Advanced",
        topics: [
          {
            id: "greedy.matroid-greedy",
            name: "Matroid-flavored greedy & exchange proofs",
            why: "Recognizing matroid structure explains why certain greedy strategies are provably optimal, not just empirically lucky.",
            resource: { label: "Competitive Programmer's Handbook (CSES)", url: "https://cses.fi/book/book.pdf" },
          },
          {
            id: "greedy.heuristic-greedy",
            name: "Randomized / greedy heuristics for NP-hard subtasks",
            why: "Some ICPC problems reward a strong greedy or randomized heuristic even without a full optimality proof.",
            resource: { label: "Codeforces EDU: courses", url: "https://codeforces.com/edu/courses" },
          },
        ],
      },
    ],
  },
  {
    id: "geometry",
    name: "Geometry",
    blurb: "Vectors and orientation tests up through convex hull and half-plane intersection.",
    phases: [
      {
        name: "Foundations",
        topics: [
          {
            id: "geometry.vectors-orientation",
            name: "Vectors, cross/dot product, orientation tests",
            why: "Nearly every geometry problem reduces to the sign of a cross product at some point.",
            resource: { label: "cp-algorithms: Basic Geometry", url: "https://cp-algorithms.com/geometry/basic-geometry.html" },
          },
          {
            id: "geometry.point-segment",
            name: "Point-in-polygon & segment intersection",
            why: "The two most commonly reused geometry primitives across ICPC problem sets.",
            resource: { label: "cp-algorithms: Check if two segments intersect", url: "https://cp-algorithms.com/geometry/check-segments-intersection.html" },
          },
        ],
      },
      {
        name: "Core",
        topics: [
          {
            id: "geometry.line-sweep",
            name: "Line sweep",
            why: "Sweeps a line across the plane processing events in order — the standard technique behind segment-intersection detection, rectangle union area, and closest-pair alternatives.",
            resource: { label: "cp-algorithms: Search for a pair of intersecting segments", url: "https://cp-algorithms.com/geometry/intersecting_segments.html" },
          },
          {
            id: "geometry.convex-hull",
            name: "Convex hull (Graham scan / monotone chain)",
            why: "The standard preprocessing step for a huge share of geometry problems — diameter, farthest pair, and more all start here.",
            resource: { label: "cp-algorithms: Convex hull construction", url: "https://cp-algorithms.com/geometry/convex-hull.html" },
          },
          {
            id: "geometry.polygon-area-picks",
            name: "Polygon area & Pick's theorem",
            why: "A closed-form way to compute area (and count lattice points) instead of any kind of numeric integration.",
            resource: { label: "cp-algorithms: Pick's Theorem", url: "https://cp-algorithms.com/geometry/picks-theorem.html" },
          },
          {
            id: "geometry.closest-pair",
            name: "Closest pair of points (divide & conquer)",
            why: "A classic O(n log n) algorithm that beats the naive O(n²) pairwise distance check.",
            resource: { label: "cp-algorithms: Finding the nearest pair of points", url: "https://cp-algorithms.com/geometry/nearest_points.html" },
          },
        ],
      },
      {
        name: "Advanced",
        topics: [
          {
            id: "geometry.rotating-calipers",
            name: "Rotating calipers",
            why: "Powers diameter, minimum bounding box, and farthest-pair queries on a convex hull in linear time.",
            resource: { label: "cp-algorithms: Convex hull construction", url: "https://cp-algorithms.com/geometry/convex-hull.html" },
          },
          {
            id: "geometry.halfplane-intersection",
            name: "Half-plane intersection",
            why: "Finds the feasible region defined by many linear constraints at once — the geometric analogue of an LP feasibility check.",
            resource: { label: "cp-algorithms: Half-plane intersection", url: "https://cp-algorithms.com/geometry/halfplane-intersection.html" },
          },
          {
            id: "geometry.circle-geometry",
            name: "Circle geometry (tangents, circle-circle/circle-line intersection)",
            why: "Rounds out your primitive toolkit for the mixed geometry problems that combine lines and circles.",
            resource: { label: "cp-algorithms: Circle-Line Intersection", url: "https://cp-algorithms.com/geometry/circle-line-intersection.html" },
          },
        ],
      },
    ],
  },
  {
    id: "meta",
    name: "Contest Meta-Skills",
    blurb: "The non-algorithmic skills — speed, recognition, and team process — that separate solving-at-home from solving-on-stage.",
    phases: [
      {
        name: "Foundations",
        topics: [
          {
            id: "meta.time-complexity",
            name: "Time complexity & Big-O budgeting",
            why: "Reading a constraint like n ≤ 10⁵ and knowing it rules out O(n²) is the single most useful reflex in this whole roadmap — every other topic below is really \"a faster way to do X.\"",
            resource: { label: "USACO Guide: Time Complexity", url: "https://usaco.guide/bronze/time-comp" },
          },
          {
            id: "meta.fast-io-templates",
            name: "Fast I/O & a personal template",
            why: "A solid template removes boilerplate friction so contest time goes to thinking, not to re-typing scaffolding.",
            resource: { label: "USACO Guide: Fast Input & Output", url: "https://usaco.guide/general/fast-io" },
          },
          {
            id: "meta.reading-problems",
            name: "Reading & parsing problems under time pressure",
            why: "Misreading one constraint is the single most common source of wasted contest time.",
            resource: { label: "USACO Guide: General resources", url: "https://usaco.guide/general" },
          },
        ],
      },
      {
        name: "Core",
        topics: [
          {
            id: "meta.problem-recognition",
            name: "Problem recognition drills",
            why: "ICPC rewards speed — learning to recognize \"this is a segment-tree problem\" within 30 seconds is a trainable skill, not raw talent.",
            resource: { label: "Codeforces EDU: courses", url: "https://codeforces.com/edu/courses" },
          },
          {
            id: "meta.mixed-topic-practice",
            name: "Mixed-topic contest simulation",
            why: "Real contests mix topics freely; practicing techniques in isolation only gets you halfway there.",
            resource: { label: "CSES Problem Set", url: "https://cses.fi/problemset/" },
          },
          {
            id: "meta.team-coordination",
            name: "Team coordination & one-computer rotation",
            why: "ICPC is a 3-person, 1-computer format — process discipline (who codes, who reads, when to rotate) wins nearly as much as raw skill.",
            resource: { label: "ICPC official site", url: "https://icpc.global" },
          },
        ],
      },
      {
        name: "Advanced",
        topics: [
          {
            id: "meta.speed-drills",
            name: "Timed speed drills (rating-banded, clock running)",
            why: "Builds the reflex of solving known-technique problems fast, instead of merely solving them correctly.",
            resource: { label: "CSES Problem Set", url: "https://cses.fi/problemset/" },
          },
          {
            id: "meta.wf-archive",
            name: "ICPC World Finals archive upsolving",
            why: "World Finals problems calibrate you to the hardest, most creative problem style you'll actually face on stage.",
            resource: { label: "ICPC World Finals Problems", url: "https://icpc.global/worldfinals/problems" },
          },
          {
            id: "meta.post-contest-review",
            name: "Post-contest analysis (editorials + a mistake log)",
            why: "Reviewing exactly why you got stuck after every contest is the fastest lever you have for improvement.",
            resource: { label: "Codeforces EDU: courses", url: "https://codeforces.com/edu/courses" },
          },
        ],
      },
    ],
  },
];

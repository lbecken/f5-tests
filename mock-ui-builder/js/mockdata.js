/* ============================================================
 * MockData — deterministic mock data for rendered components.
 * Data is index-based (not random) so every render is stable.
 * ============================================================ */
(function (global) {
  'use strict';

  const FIRST = ['Amy', 'Bruno', 'Clara', 'David', 'Elena', 'Frank', 'Grace', 'Hugo', 'Iris', 'James', 'Karin', 'Louis', 'Maria', 'Nils', 'Olivia', 'Pedro', 'Quinn', 'Rosa', 'Stefan', 'Tanya'];
  const LAST = ['Almeida', 'Baker', 'Costa', 'Dubois', 'Evans', 'Fischer', 'Garcia', 'Hansen', 'Ivanov', 'Jensen', 'Klein', 'Lopez', 'Martins', 'Novak', 'Oliveira', 'Peters', 'Quintana', 'Rossi', 'Silva', 'Torres'];
  const COUNTRIES = ['Brazil', 'Germany', 'France', 'Spain', 'Italy', 'Portugal', 'Netherlands', 'Sweden', 'Canada', 'Japan', 'Australia', 'Mexico'];
  const CITIES = ['Berlin', 'Lisbon', 'Paris', 'Madrid', 'Rome', 'Vienna', 'Oslo', 'Tokyo', 'Toronto', 'Sydney', 'Porto', 'Munich'];
  const PRODUCTS = ['Bamboo Watch', 'Black Watch', 'Blue Band', 'Blue T-Shirt', 'Bracelet', 'Brown Purse', 'Chakra Bracelet', 'Galaxy Earrings', 'Game Controller', 'Gaming Set', 'Gold Phone Case', 'Green Earbuds'];
  const CATEGORIES = ['Accessories', 'Clothing', 'Electronics', 'Fitness'];
  const STATUSES = ['INSTOCK', 'LOWSTOCK', 'OUTOFSTOCK'];
  const ORDER_STATUS = ['Delivered', 'Pending', 'Shipped', 'Cancelled'];
  const ROLES = ['Administrator', 'Manager', 'Developer', 'Designer', 'Analyst', 'Support'];
  const DEPARTMENTS = ['Sales', 'Engineering', 'Marketing', 'Finance', 'Support', 'Operations'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.';

  function pick(arr, i) { return arr[((i % arr.length) + arr.length) % arr.length]; }

  const MockData = {
    firstName: (i) => pick(FIRST, i),
    lastName: (i) => pick(LAST, i * 7 + 3),
    fullName: (i) => pick(FIRST, i) + ' ' + pick(LAST, i * 7 + 3),
    initials: (i) => pick(FIRST, i)[0] + pick(LAST, i * 7 + 3)[0],
    email: (i) => (pick(FIRST, i) + '.' + pick(LAST, i * 7 + 3)).toLowerCase() + '@example.com',
    country: (i) => pick(COUNTRIES, i),
    city: (i) => pick(CITIES, i),
    product: (i) => pick(PRODUCTS, i),
    category: (i) => pick(CATEGORIES, i),
    status: (i) => pick(STATUSES, i),
    orderStatus: (i) => pick(ORDER_STATUS, i),
    role: (i) => pick(ROLES, i),
    department: (i) => pick(DEPARTMENTS, i),
    month: (i) => pick(MONTHS, i),
    price: (i) => '$' + (19 + ((i * 37) % 480) + 0.99 * ((i % 2))).toFixed(2),
    quantity: (i) => 1 + ((i * 13) % 98),
    percent: (i) => 15 + ((i * 23) % 80),
    phone: (i) => '(555) 01' + String(10 + (i * 17) % 89) + '-' + String(1000 + (i * 271) % 8999),
    id: (i) => String(1000 + i),
    date: function (i) {
      const d = new Date(2026, (i * 3) % 12, 1 + ((i * 11) % 27));
      return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    },
    time: (i) => String(8 + (i * 3) % 10).padStart(2, '0') + ':' + String((i * 17) % 60).padStart(2, '0'),
    lorem: function (words) {
      const w = LOREM.split(' ');
      let out = [];
      for (let k = 0; k < words; k++) out.push(w[k % w.length]);
      return out.join(' ');
    },
    sentence: (i) => LOREM.split('. ')[i % 4] + '.',
    /* Series of n values in [min,max] for charts, deterministic. */
    series: function (n, min, max, seed) {
      seed = seed || 1;
      const out = [];
      for (let k = 0; k < n; k++) {
        const v = Math.abs(Math.sin((k + 1) * (seed + 2) * 1.7)) ;
        out.push(Math.round(min + v * (max - min)));
      }
      return out;
    },
    rows: function (n) {
      const out = [];
      for (let i = 0; i < n; i++) {
        out.push({
          id: MockData.id(i), name: MockData.fullName(i), email: MockData.email(i),
          country: MockData.country(i), city: MockData.city(i), role: MockData.role(i),
          product: MockData.product(i), category: MockData.category(i),
          price: MockData.price(i), quantity: MockData.quantity(i),
          status: MockData.status(i), orderStatus: MockData.orderStatus(i),
          date: MockData.date(i), percent: MockData.percent(i)
        });
      }
      return out;
    },
    cell: function (col, i) {
      const key = col.trim().toLowerCase();
      const map = {
        'id': MockData.id, '#': MockData.id, 'code': (k) => 'PX-' + (2400 + k * 3),
        'name': MockData.fullName, 'full name': MockData.fullName,
        'first name': MockData.firstName, 'last name': MockData.lastName,
        'email': MockData.email, 'e-mail': MockData.email,
        'country': MockData.country, 'city': MockData.city,
        'role': MockData.role, 'department': MockData.department,
        'product': MockData.product, 'item': MockData.product,
        'category': MockData.category, 'price': MockData.price,
        'amount': MockData.price, 'total': MockData.price,
        'quantity': MockData.quantity, 'qty': MockData.quantity,
        'status': MockData.orderStatus, 'stock': MockData.status,
        'date': MockData.date, 'created': MockData.date, 'updated': MockData.date,
        'time': MockData.time, 'phone': MockData.phone,
        'progress': (k) => MockData.percent(k) + '%'
      };
      if (map[key]) return String(map[key](i));
      /* Unknown column: derive plausible generic text */
      return pick(['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'], i + key.length);
    }
  };

  global.MockData = MockData;
})(window);

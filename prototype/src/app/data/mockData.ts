import type { Movie, Screening, Cinema, Campaign, PurchasedTicket } from "./types";

export const movies: Movie[] = [
  {
    id: "1",
    title: "Pulp Fiction",
    genre: "Crime Thriller",
    year: 1994,
    director: "Quentin Tarantino",
    synopsis:
      "The lives of two mob hitmen, a boxer, a gangster and his wife intertwine in four tales of violence and redemption. A nonlinear masterpiece that revolutionized independent cinema with its sharp dialogue and memorable characters.",
    posterUrl:
      "https://image.tmdb.org/t/p/original/vQWk5YBFWF4bZaofAbv0tShwBvQ.jpg",
  },
  {
    id: "2",
    title: "John Wick",
    genre: "Action Thriller",
    year: 2014,
    director: "Chad Stahelski",
    synopsis:
      "An ex-hitman comes out of retirement to track down the gangsters that killed his dog and took everything from him. A stylish, kinetic action masterpiece that redefined the modern action genre with its intricate fight choreography.",
    posterUrl:
      "https://image.tmdb.org/t/p/original/wXqWR7dHncNRbxoEGybEy7QTe9h.jpg",
  },
  {
    id: "3",
    title: "Pride and Prejudice",
    genre: "Romantic Drama",
    year: 2005,
    director: "Joe Wright",
    synopsis:
      "Sparks fly when spirited Elizabeth Bennet meets single, rich, and proud Mr. Darcy. But Mr. Darcy reluctantly finds himself falling in love with a woman beneath his class. Can each overcome their own pride and prejudice?",
    posterUrl:
      "https://image.tmdb.org/t/p/original/rlqOyCEaZuKoYTI1vhZ0kVyCTV7.jpg",
  },
  {
    id: "4",
    title: "Titanic",
    genre: "Romance Drama",
    year: 1997,
    director: "James Cameron",
    synopsis:
      "A seventeen-year-old aristocrat falls in love with a kind but poor artist aboard the luxurious, ill-fated R.M.S. Titanic. An epic romance and disaster film that became a cultural phenomenon and one of the highest-grossing films of all time.",
    posterUrl:
      "https://image.tmdb.org/t/p/original/5bTWA20cL9LCIGNpde4Epc2Ijzn.jpg",
  },
  {
    id: "5",
    title: "The Thing",
    genre: "Horror Sci-Fi",
    year: 1982,
    director: "John Carpenter",
    synopsis:
      "A research team in Antarctica is hunted by a shape-shifting alien that assumes the appearance of its victims. Paranoia and suspicion spread as the crew members realize anyone could be the creature.",
    posterUrl:
      "https://image.tmdb.org/t/p/original/tzGY49kseSE9QAKk47uuDGwnSCu.jpg",
  },
  {
    id: "6",
    title: "Star Wars: A New Hope",
    genre: "Sci-Fi Adventure",
    year: 1977,
    director: "George Lucas",
    synopsis:
      "Luke Skywalker joins forces with a Jedi Knight, a cocky pilot, a Wookiee and two droids to save the galaxy from the Empire's world-destroying battle station, while also attempting to rescue Princess Leia from the mysterious Darth Vader.",
    posterUrl:
      "https://image.tmdb.org/t/p/original/fai0rspsNeJCS69wHNjOdWxcI7P.jpg",
  },
  {
    id: "7",
    title: "Mad Max: Fury Road",
    genre: "Action Adventure",
    year: 2015,
    director: "George Miller",
    synopsis:
      "In a post-apocalyptic wasteland, a woman rebels against a tyrannical ruler in search for her homeland with the aid of a group of female prisoners, a psychotic worshiper, and a drifter named Max. A relentless, high-octane chase across the desert.",
    posterUrl:
      "https://image.tmdb.org/t/p/original/8tZYtuWezp8JbcsvHYO0O46tFbo.jpg",
  },
  {
    id: "8",
    title: "The Dark Knight",
    genre: "Action Thriller",
    year: 2008,
    director: "Christopher Nolan",
    synopsis:
      "Batman raises the stakes in his war on crime. With the help of Lt. Jim Gordon and District Attorney Harvey Dent, Batman sets out to dismantle the remaining criminal organizations that plague the streets. The partnership proves to be effective, but they soon find themselves prey to a reign of chaos unleashed by a rising criminal mastermind known to the terrified citizens of Gotham as the Joker.",
    posterUrl:
      "https://image.tmdb.org/t/p/original/xQPgyZOBhaz1GdCQIPf5A5VeFzO.jpg",
  },
];

export const cinemas: Cinema[] = [
  {
    id: "c1",
    name: "Kino Europa",
    location: "Varšavska 3, Zagreb",
    capacity: 180,
    priceFrom: 150,
    amenities: [
      "35mm projection",
      "Digital 4K",
      "Premium sound",
      "Full bar",
      "Wheelchair accessible",
    ],
    description:
      "Historic cinema in the heart of Zagreb, featuring state-of-the-art projection and sound systems. Perfect for larger events with its spacious auditorium and sophisticated ambiance.",
    imageUrl:
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaW5lbWElMjB0aGVhdGVyJTIwaW50ZXJpb3J8ZW58MXx8fHwxNzQyNDk1MjQwfDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "c2",
    name: "Kino Tuškanac",
    location: "Tuškanac 1, Zagreb",
    capacity: 80,
    priceFrom: 80,
    amenities: [
      "Digital projection",
      "Cozy seating",
      "Café area",
      "Student-friendly",
    ],
    description:
      "Intimate screening space perfect for student groups and independent filmmakers. Affordable rates and flexible scheduling make it ideal for smaller gatherings.",
    imageUrl:
      "https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzbWFsbCUyMGNpbmVtYSUyMGluZGVwZW5kZW50fGVufDF8fHx8MTc0MjQ5NTI0MHww&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "c3",
    name: "ArtHouse Zagreb",
    location: "Tkalčićeva 42, Zagreb",
    capacity: 120,
    priceFrom: 100,
    amenities: [
      "Digital 4K",
      "Premium seating",
      "Wine bar",
      "Art gallery space",
    ],
    description:
      "Boutique cinema specializing in art house films and private events. Elegant interior and curated atmosphere perfect for sophisticated gatherings.",
    imageUrl:
      "https://images.unsplash.com/photo-1478720568477-152d9b164e26?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnQlMjBob3VzZSUyMGNpbmVtYXxlbnwxfHx8fDE3NDI0OTUyNDB8MA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "c4",
    name: "Kino Kinoteka",
    location: "Kordunska 27, Zagreb",
    capacity: 200,
    priceFrom: 200,
    amenities: [
      "IMAX",
      "Dolby Atmos",
      "VIP lounge",
      "Catering available",
      "Premium parking",
    ],
    description:
      "Modern multiplex with the largest screen in Zagreb. Ideal for big events with impressive technical capabilities and full-service amenities.",
    imageUrl:
      "https://images.unsplash.com/photo-1568876694728-451bbf694b83?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBjaW5lbWElMjBtdWx0aXBsZXh8ZW58MXx8fHwxNzQyNDk1MjQwfDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
];

export const screenings: Screening[] = [
  {
    id: "s1",
    movie: movies[0],
    cinema: "Kino Europa",
    location: "Zagreb",
    dateTime: "Sat, Mar 22 • 8:00 PM",
    price: 8.5,
    status: "confirmed",
    ticketsSold: 50,
    threshold: 50,
  },
  {
    id: "s2",
    movie: movies[3],
    cinema: "ArtHouse Zagreb",
    location: "Zagreb",
    dateTime: "Sun, Mar 23 • 6:30 PM",
    price: 7.0,
    status: "confirmed",
    ticketsSold: 45,
    threshold: 40,
  },
  {
    id: "s3",
    movie: movies[5],
    cinema: "Kino Kinoteka",
    location: "Zagreb",
    dateTime: "Fri, Mar 21 • 9:30 PM",
    price: 9.0,
    status: "on-sale",
    ticketsSold: 32,
    threshold: 60,
    deadlineText: "6 days left",
  },
  {
    id: "s4",
    movie: movies[1],
    cinema: "Kino Tuškanac",
    location: "Zagreb",
    dateTime: "Thu, Mar 20 • 7:30 PM",
    price: 6.5,
    status: "confirmed",
    ticketsSold: 52,
    threshold: 50,
  },
  {
    id: "s5",
    movie: movies[2],
    cinema: "Kino Europa",
    location: "Zagreb",
    dateTime: "Tue, Mar 25 • 8:00 PM",
    price: 8.0,
    status: "on-sale",
    ticketsSold: 21,
    threshold: 60,
    deadlineText: "4 days left",
  },
  {
    id: "s6",
    movie: movies[4],
    cinema: "ArtHouse Zagreb",
    location: "Zagreb",
    dateTime: "Wed, Mar 26 • 9:00 PM",
    price: 7.5,
    status: "on-sale",
    ticketsSold: 22,
    threshold: 45,
    deadlineText: "6 days left",
  },
  {
    id: "s8",
    movie: movies[7],
    cinema: "Kino Kinoteka",
    location: "Zagreb",
    dateTime: "Sat, Mar 29 • 7:00 PM",
    price: 9.5,
    status: "at-risk",
    ticketsSold: 45,
    threshold: 70,
    deadlineText: "1 day left",
  },
];

export const initialCampaigns: Campaign[] = [
  {
    id: "c1",
    cinema: "Kino Tuškanac",
    location: "Zagreb, Croatia",
    slot: "Sat, Mar 29 • 7:00 PM",
    timeLeft: "2 days left",
    votingDeadline: "Mar 22, 2026 19:00:00",
    candidates: [movies[1], movies[2], movies[4], movies[0]],
    votes: { "2": 72, "3": 58, "5": 43, "1": 35 },
    threshold: 100,
    ticketPrice: 10,
  },
  {
    id: "c2",
    cinema: "Kino Europa",
    location: "Zagreb, Croatia",
    slot: "Sun, Mar 30 • 8:30 PM",
    timeLeft: "4 days left",
    votingDeadline: "Mar 23, 2026 20:30:00",
    candidates: [movies[0], movies[5], movies[3], movies[7]],
    votes: { "1": 45, "6": 38, "4": 29, "8": 22 },
    threshold: 80,
    ticketPrice: 9,
  },
];

export const initialPurchasedTickets: PurchasedTicket[] = [
  {
    id: "t1",
    screening: {
      id: "s1",
      movie: movies[0],
      cinema: "Kino Europa",
      dateTime: "Sat, Mar 22 • 8:00 PM",
      price: 9,
      status: "confirmed",
    },
    ticketQuantity: 2,
    totalPaid: 18.5,
    purchaseDate: "2026-03-15T10:30:00Z",
    status: "confirmed",
  },
  {
    id: "t2",
    screening: {
      id: "s10",
      movie: movies[1],
      cinema: "Student Film Hall",
      dateTime: "Sat, Mar 29 • 7:00 PM",
      price: 9.5,
      status: "at-risk",
      ticketsSold: 45,
      threshold: 70,
      deadlineText: "1 day left",
    },
    ticketQuantity: 1,
    totalPaid: 10,
    purchaseDate: "2026-03-16T14:20:00Z",
    status: "pending",
  },
];

export const demandOverTimeData = [
  { day: "Mon", views: 124, votes: 32, tickets: 18 },
  { day: "Tue", views: 186, votes: 45, tickets: 24 },
  { day: "Wed", views: 215, votes: 58, tickets: 31 },
  { day: "Thu", views: 198, votes: 51, tickets: 28 },
  { day: "Fri", views: 267, votes: 72, tickets: 42 },
  { day: "Sat", views: 312, votes: 89, tickets: 56 },
  { day: "Sun", views: 289, votes: 78, tickets: 48 },
];

export const heatmapData = [
  {
    time: "12pm",
    Mon: 12,
    Tue: 18,
    Wed: 15,
    Thu: 14,
    Fri: 22,
    Sat: 45,
    Sun: 38,
  },
  {
    time: "3pm",
    Mon: 18,
    Tue: 22,
    Wed: 25,
    Thu: 24,
    Fri: 32,
    Sat: 52,
    Sun: 48,
  },
  {
    time: "6pm",
    Mon: 35,
    Tue: 42,
    Wed: 38,
    Thu: 45,
    Fri: 68,
    Sat: 85,
    Sun: 72,
  },
  {
    time: "9pm",
    Mon: 28,
    Tue: 35,
    Wed: 32,
    Thu: 38,
    Fri: 72,
    Sat: 95,
    Sun: 68,
  },
];

export const topVotedFilms = [
  { movie: movies[1], votes: 72, trend: "up" as const, change: "+12" },
  { movie: movies[2], votes: 58, trend: "up" as const, change: "+8" },
  {
    movie: movies[4],
    votes: 43,
    trend: "down" as const,
    change: "-3",
  },
];

export const contentDemand = [
  {
    title: "Lost in Translation",
    searches: 156,
    noScreening: true,
  },
  { title: "Parasite", searches: 142, noScreening: true },
  {
    title: "The Grand Budapest Hotel",
    searches: 128,
    noScreening: true,
  },
  { title: "John Wick", searches: 98, noScreening: false },
  { title: "Pulp Fiction", searches: 87, noScreening: false },
];

export const privateBookingStats = {
  screeningBookings: 8,
  rentalBookings: 3,
  avgGroupSize: 42,
  mostRequestedDates: [
    "Sat, Apr 5",
    "Sat, Apr 12",
    "Fri, Apr 18",
  ],
};
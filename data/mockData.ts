// Placeholder data for the event management app

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName?: string;
  profileImage?: string;
  isOrganizer: boolean;
  organizerStatus: 'pending' | 'approved' | 'rejected' | 'none';
}

export interface Event {
  id: string;
  title: string;
  description: string;
  fullDescription?: string;
  date: string;
  time: string;
  endTime?: string;
  venue: string;
  city: string;
  category: string;
  image: string;
  organizerId: string;
  organizerName: string;
  price?: number;
  registrationDeadline?: string;
  accessType: 'open' | 'invite-only' | 'paid';
  registeredUsers: string[];
  likedUsers: string[];
  entryPolicy?: string;
  // Optional host & attendees metadata when using real API data
  hostAvatarUrl?: string | null;
  joinedUsers?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  }[];
  joinedCount?: number;
}

export interface Ticket {
  id: string;
  eventId: string;
  eventTitle: string;
  userId: string;
  userName: string;
  qrCode: string;
  purchaseDate: string;
  ticketNumber: string;
}

// Mock User Data
export const mockUser: User = {
  id: 'org-1', // Using org-1 so user can have created events
  name: 'Fatima Ali',
  email: 'fatimaali@gmail.com',
  phone: '+92 334495437',
  companyName: 'Paymo events',
  isOrganizer: true,
  organizerStatus: 'approved',
};

// Mock Events Data
export const mockEvents: Event[] = [
  {
    id: 'event-1',
    title: 'Qawali Night by SLUMS',
    description: 'SLUMS presents a Qawwali Night live on campus on 4th January, an evening of soulful music, powerful poetry, and spiritual energy.',
    fullDescription: 'SLUMS presents a Qawwali Night live on campus on 4th January, an evening of soulful music, powerful poetry, and spiritual energy. Join us for an unforgettable night of timeless melodies and trance-like rhythms.',
    date: '2025-01-04',
    time: '7:30 PM',
    endTime: '11:30 PM',
    venue: 'LUMS School Of Education, U Block',
    city: 'Lahore',
    category: 'Music',
    image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800',
    organizerId: 'org-1',
    organizerName: 'SLUMS',
    registrationDeadline: '2025-01-04T19:00:00',
    accessType: 'open',
    registeredUsers: [],
    likedUsers: [],
    entryPolicy: 'Outsiders are allowed only through LUMS',
  },
  {
    id: 'event-2',
    title: 'SLUMS Presents LSF\'26',
    description: 'Bilal Saeed and Somewhat Super performing live at LUMS Sports Fest',
    fullDescription: 'Join us for an electrifying night with Bilal Saeed and Somewhat Super at the LUMS Sports Fest. Experience live performances, amazing energy, and unforgettable moments.',
    date: '2025-01-05',
    time: '6:00 PM',
    endTime: '11:00 PM',
    venue: 'LUMS Sports Complex',
    city: 'Lahore',
    category: 'Music',
    image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
    organizerId: 'org-1',
    organizerName: 'SLUMS',
    accessType: 'open',
    registeredUsers: [],
    likedUsers: [],
  },
  {
    id: 'event-3',
    title: 'Twilight Wood Fest',
    description: 'New Year celebration in Sharan Forest - 9th-11th January',
    fullDescription: 'Experience the magic of the new year in the beautiful Sharan Forest. Three days of music, camping, and celebration. Suitable for people from Sialkot, Lahore & Islamabad.',
    date: '2025-01-09',
    time: '6:00 PM',
    endTime: '2025-01-11T11:00:00',
    venue: 'Sharan Forest',
    city: 'Lahore',
    category: 'Festival',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    organizerId: 'org-2',
    organizerName: 'Forest Events',
    price: 16200,
    accessType: 'paid',
    registeredUsers: [],
    likedUsers: [],
  },
  {
    id: 'event-4',
    title: 'Women In Tech Fest \'26',
    description: 'Coding Beyond Borders - A celebration of women in technology',
    fullDescription: 'Join LWOC LUMS Women in Computing for an inspiring tech festival featuring workshops, talks, and networking opportunities for women in technology.',
    date: '2025-01-23',
    time: '9:00 AM',
    endTime: '5:00 PM',
    venue: 'Lahore University of Management Sciences',
    city: 'Lahore',
    category: 'Technology',
    image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800',
    organizerId: 'org-3',
    organizerName: 'LWOC',
    accessType: 'open',
    registeredUsers: [],
    likedUsers: [],
  },
  {
    id: 'event-5',
    title: 'Pakistan Tour X HAVI',
    description: 'HAVI Pakistan Tour featuring COORDS Pakistan',
    fullDescription: 'Don\'t miss this exclusive tour featuring HAVI and COORDS Pakistan. An unforgettable night of music and entertainment.',
    date: '2025-01-03',
    time: '8:00 PM',
    endTime: '11:00 PM',
    venue: 'Marina Club DHA Phase 8',
    city: 'Karachi',
    category: 'Music',
    image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
    organizerId: 'org-4',
    organizerName: 'HAVI',
    accessType: 'paid',
    price: 2500,
    registeredUsers: [],
    likedUsers: [],
  },
  {
    id: 'event-6',
    title: 'Mehfil e Ishq',
    description: 'Sunday Qawwali night with Dawal Imran and Rahat Ali',
    fullDescription: 'Experience the soulful melodies of traditional Qawwali with Dawal Imran and Rahat Ali at Alhamra Art Center.',
    date: '2025-01-04',
    time: '5:00 PM',
    endTime: '8:00 PM',
    venue: 'Alhamra Art Center, Hall 2',
    city: 'Lahore',
    category: 'Music',
    image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800',
    organizerId: 'org-5',
    organizerName: 'Eventistry',
    price: 2000,
    accessType: 'paid',
    registeredUsers: [],
    likedUsers: [],
  },
];

// Helper functions
export const getEventById = (id: string): Event | undefined => {
  return mockEvents.find(event => event.id === id);
};

export const getUserEvents = (userId: string): Event[] => {
  return mockEvents.filter(event => event.registeredUsers.includes(userId));
};

export const getUserLikedEvents = (userId: string): Event[] => {
  return mockEvents.filter(event => event.likedUsers.includes(userId));
};

export const getOrganizerEvents = (organizerId: string): Event[] => {
  return mockEvents.filter(event => event.organizerId === organizerId);
};


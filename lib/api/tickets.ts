import apiClient from './client';

// ==================== TYPE DEFINITIONS ====================

export interface Ticket {
  id: string;
  event: {
    _id: string;
    title: string;
    description: string;
    date: string;
    time: string;
    location: string;
    image?: string;
    ticketPrice: number;
    phone?: string;
    ticketTheme?: import('./events').TicketTheme;
    createdBy?: {
      _id: string;
      fullName: string;
      username?: string;
      email: string;
      phone?: string;
    };
  };
  organizer?: {
    _id: string;
    fullName: string;
    username?: string;
    email: string;
    phone?: string;
  };
  user?: {
    _id: string;
    fullName: string;
    username?: string;
    email: string;
  };
  username: string;
  email: string;
  phone: string;
  status: 'pending_payment' | 'payment_in_review' | 'confirmed' | 'used' | 'cancelled';
  accessKey?: string;
  qrCodeUrl?: string;
  paymentScreenshotUrl?: string;
  createdAt: string;
  updatedAt: string;
  scannedAt?: string;
}

export interface CreateTicketRequest {
  eventId: string;
  username: string;
  email: string;
  phone: string;
}

export interface CreateTicketResponse {
  success: boolean;
  message: string;
  ticket: {
    id: string;
    eventId: string;
    username: string;
    email: string;
    phone: string;
    status: string;
    createdAt: string;
  };
}

export interface GetMyTicketsResponse {
  success: boolean;
  count: number;
  tickets: Ticket[];
}

export interface GetTicketByIdResponse {
  success: boolean;
  ticket: Ticket;
}

export interface ScanTicketRequest {
  accessKey: string;
}

export interface ScanTicketResponse {
  success: boolean;
  message: string;
  ticket: {
    id: string;
    event: {
      _id: string;
      title: string;
      date: string;
      time: string;
      location: string;
    };
    user: {
      _id: string;
      fullName: string;
      username?: string;
      email: string;
    };
    username: string;
    status: string;
    scannedAt: string;
  };
}

export interface UpdateTicketStatusByKeyRequest {
  accessKey: string;
  status: 'used' | 'cancelled';
}

export interface UpdateTicketStatusByKeyResponse {
  success: boolean;
  message: string;
  ticket: {
    id: string;
    accessKey: string;
    status: string;
    user: {
      _id: string;
      fullName: string;
      email: string;
      username?: string;
    };
    event: {
      _id: string;
      title: string;
      date: string;
    };
    updatedAt: string;
  };
}

// ==================== TICKET API FUNCTIONS ====================

export const ticketsAPI = {
  /**
   * Create a new ticket for an event
   * Requires authentication
   * @param data - Ticket creation data
   * @returns Created ticket information
   */
  createTicket: async (data: CreateTicketRequest): Promise<CreateTicketResponse> => {
    const response = await apiClient.post('/tickets', data);
    return response.data;
  },

  /**
   * Get all tickets for the authenticated user
   * Requires authentication
   * @returns List of user's tickets
   */
  getMyTickets: async (): Promise<GetMyTicketsResponse> => {
    const response = await apiClient.get('/tickets/my');
    return response.data;
  },

  /**
   * Get a specific ticket by ID
   * Requires authentication
   * Role-based access: Users can see their own tickets, organizers can see tickets for their events, admins can see all
   * @param ticketId - The ticket ID
   * @returns Ticket details
   */
  getTicketById: async (ticketId: string): Promise<GetTicketByIdResponse> => {
    const response = await apiClient.get(`/tickets/${ticketId}`);
    return response.data;
  },

  /**
   * Scan a ticket for entry validation
   * Public endpoint (no authentication required)
   * @param data - Scan ticket data containing accessKey
   * @returns Ticket validation result
   */
  scanTicket: async (data: ScanTicketRequest): Promise<ScanTicketResponse> => {
    const response = await apiClient.post('/tickets/scan', data);
    return response.data;
  },

  /**
   * Update ticket status by accessKey (ticket #)
   * Requires organizer authentication
   * Only works if ticket status is "confirmed"
   * Can only update to "used" or "cancelled"
   * @param data - Update ticket status data containing accessKey and status
   * @returns Updated ticket information
   */
  updateTicketStatusByKey: async (data: UpdateTicketStatusByKeyRequest): Promise<UpdateTicketStatusByKeyResponse> => {
    const response = await apiClient.put('/tickets/update-status-by-key', data);
    return response.data;
  },
};


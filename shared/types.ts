/* New Game */
export interface NewGameRequest {
  opponent: string;
}

export interface NewGameSuccessResponse {
  success: true;
  message: string;
}

export interface NewGameErrorResponse {
  success: false;
  error: string;
}

export type NewGameResponse = NewGameSuccessResponse | NewGameErrorResponse;


/* GetMove */
export interface GetMoveRequest {
  board: string;
  opponent: string;
}

export interface SuccessfulGetMoveResponse {
  move: {
    from: string;
    to: string;
    promotion?: string;
  };
  evaluation: number;
}

export interface ErrorResponse {
  error: string;
}

export type GetMoveResponse = SuccessfulGetMoveResponse | ErrorResponse;

/* Move */
export interface MoveRequest {
  from: string;
  to: string;
  promotion?: string;
  san: string; // Add the SAN move property
}

export interface SuccessfulMoveResponse {
  success: true;
  message: string;
}

export interface ErrorMoveResponse {
  success: false;
  error: string;
}

export type MoveResponse = SuccessfulMoveResponse | ErrorMoveResponse;

/* User */
export interface User {
  id: string;
  username: string;
  elo: number;
}

export interface UserRegistrationRequest {
  username: string;
  password: string;
}

export interface UserLoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  username?: string;
  elo?: number;
  error?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface OnlineUser {
  id: string;
  username: string;
}

/* WebSocket Messages */

export type WebSocketMessage =
  | {
      type: 'login';
      username: string;
    }
  | {
      type: 'challenge';
      from: string;
      to: string;
    }
  | {
      type: 'challenge_received';
      from: string;
    }
  | {
      type: 'challenge_response';
      from: string;
      to: string;
      accepted: boolean;
    }
  | {
      type: 'start_game';
      opponent: string;
    };

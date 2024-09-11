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
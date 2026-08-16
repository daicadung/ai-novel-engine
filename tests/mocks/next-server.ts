export class NextResponse { 
  static json(body: any, init?: ResponseInit) { 
    return new Response(JSON.stringify(body), init); 
  } 
  static next() { 
    return new Response(); 
  } 
  static redirect() { 
    return new Response(); 
  } 
} 
export class NextRequest extends Request {}

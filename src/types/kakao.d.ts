/**
 * 카카오 지도 SDK 의 최소 타입 선언.
 *
 * 공식 @types 패키지가 없어서 우리가 실제로 부르는 것만 좁게 적는다.
 * 넓게 `any` 로 두면 오타가 런타임까지 살아남으므로, 쓰는 만큼만 좁힌다.
 */

export interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}

export interface KakaoBounds {
  getSouthWest(): KakaoLatLng;
  getNorthEast(): KakaoLatLng;
  extend(latlng: KakaoLatLng): void;
}

export interface KakaoCustomOverlay {
  setMap(map: KakaoMap | null): void;
}

export interface KakaoMap {
  getCenter(): KakaoLatLng;
  setCenter(latlng: KakaoLatLng): void;
  getBounds(): KakaoBounds;
  setBounds(bounds: KakaoBounds): void;
  setLevel(level: number): void;
  setMaxLevel(level: number): void;
  panTo(latlng: KakaoLatLng): void;
  relayout(): void;
  addControl(control: unknown, position: unknown): void;
}

/** `kakao.maps` 네임스페이스. 생성자는 `new` 시그니처로 적는다. */
export interface KakaoMaps {
  load(callback: () => void): void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoBounds;
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap;
  CustomOverlay: new (options: {
    position: KakaoLatLng;
    content: HTMLElement | string;
    yAnchor?: number;
    clickable?: boolean;
    zIndex?: number;
  }) => KakaoCustomOverlay;
  ZoomControl: new () => unknown;
  ControlPosition: Record<'RIGHT' | 'TOP' | 'LEFT' | 'BOTTOM', unknown>;
  event: {
    addListener(target: unknown, type: string, handler: () => void): void;
  };
}

declare global {
  interface Window {
    kakao?: { maps?: KakaoMaps };
  }
}

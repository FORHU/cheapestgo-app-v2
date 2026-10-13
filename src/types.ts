export interface TelemetryData {
    label:     string;
    value:     string;
    trend?:    'down' | 'up';
    icon?:     'chart' | 'plane' | 'sun';
    subValue?: string;
}

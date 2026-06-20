import 'uno.css';
import './app.css';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import { mount } from 'svelte';
import App from './App.svelte';

// 'LL LT' → "April 7, 2026 3:01 AM". ST formats with moment's same tokens.
dayjs.extend(localizedFormat);

mount(App, { target: document.getElementById('app')! });

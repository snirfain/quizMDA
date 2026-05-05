/**
 * Form Field Component
 * Accessible form field with label, error, and help text
 * Hebrew: שדה טופס
 */

import React from 'react';
import { generateAccessibleId } from '../utils/accessibility';

export default function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error = null,
  helpText = null,
  required = false,
  disabled = false,
  placeholder = '',
  ariaDescribedBy = null,
  children = null,
  /** Smaller vertical spacing (e.g. grid rows of selects) */
  compact = false,
  /** Optional bottom spacing override (number = px); default from container.style */
  marginBottom = undefined,
  ...props
}) {
  const fieldId = React.useMemo(() => generateAccessibleId(`field-${name}`), [name]);
  const errorId = error ? `${fieldId}-error` : null;
  const helpId = helpText ? `${fieldId}-help` : null;
  
  const describedBy = [
    errorId,
    helpId,
    ariaDescribedBy
  ].filter(Boolean).join(' ') || undefined;

  const isSelect   = type === 'select';
  const isTextarea = type === 'textarea';
  const InputComponent = isTextarea ? 'textarea' : isSelect ? 'select' : 'input';

  let containerSx = compact ? styles.containerCompact : styles.container;
  if (marginBottom !== undefined) {
    containerSx = {
      ...containerSx,
      marginBottom: typeof marginBottom === 'number' ? `${marginBottom}px` : marginBottom,
    };
  }
  const labelSx = compact ? styles.labelCompact : styles.label;
  const inputSx = compact ? { ...styles.input, ...styles.inputCompact } : styles.input;

  return (
    <div style={containerSx}>
      {label && (
        <label
          htmlFor={fieldId}
          style={labelSx}
        >
          {label}
          {required && (
            <span style={styles.required} aria-label="שדה חובה">
              *
            </span>
          )}
        </label>
      )}

      <InputComponent
        id={fieldId}
        name={name}
        type={!isTextarea && !isSelect ? type : undefined}
        value={value || ''}
        onChange={onChange}
        disabled={disabled}
        placeholder={!isSelect ? placeholder : undefined}
        required={required}
        aria-required={required}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={describedBy}
        aria-label={!label ? placeholder : undefined}
        style={{
          ...inputSx,
          ...(isTextarea ? styles.textarea : {}),
          ...(error ? styles.inputError : {}),
          ...(disabled ? styles.inputDisabled : {}),
        }}
        {...props}
      >
        {(isSelect || isTextarea) ? children : null}
      </InputComponent>

      {helpText && !error && (
        <div id={helpId} style={styles.helpText} role="note">
          {helpText}
        </div>
      )}

      {error && (
        <div
          id={errorId}
          style={styles.errorText}
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    marginBottom: '20px',
    direction: 'rtl',
    width: '100%',
  },
  containerCompact: {
    marginBottom: '0',
    direction: 'rtl',
    width: '100%',
    minWidth: 0,
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#212121',
  },
  labelCompact: {
    display: 'block',
    marginBottom: '4px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#212121',
  },
  required: {
    color: '#f44336',
    marginRight: '4px'
  },
  inputCompact: {
    padding: '7px 10px',
    fontSize: '13px',
    minHeight: '38px',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    direction: 'rtl',
    textAlign: 'right',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s ease',
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px',
      borderColor: '#CC0000'
    },
    '&:disabled': {
      backgroundColor: '#f5f5f5',
      cursor: 'not-allowed'
    }
  },
  textarea: {
    minHeight: '100px',
    resize: 'vertical'
  },
  inputError: {
    borderColor: '#f44336',
    '&:focus': {
      outlineColor: '#f44336',
      borderColor: '#f44336'
    }
  },
  inputDisabled: {
    backgroundColor: '#f5f5f5',
    color: '#757575',
    cursor: 'not-allowed'
  },
  helpText: {
    marginTop: '4px',
    fontSize: '12px',
    color: '#757575'
  },
  errorText: {
    marginTop: '4px',
    fontSize: '12px',
    color: '#f44336',
    fontWeight: '500'
  }
};

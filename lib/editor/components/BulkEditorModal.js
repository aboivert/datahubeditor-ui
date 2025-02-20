// @flow

import Icon from '@conveyal/woonerf/components/icon'
import React, { Component } from 'react'
import { Alert, Button, ControlLabel, FormControl, Modal } from 'react-bootstrap'

import * as editorActions from '../actions/editor'
import * as snapshotActions from '../actions/snapshots'
import EditorInput from './EditorInput'
import { getZones, getEditorTable } from '../util'
import { getTableById } from '../util/gtfs'
import { validate } from '../util/validation'
import { formatTimestamp } from '../../common/util/date-time'

import type { Entity, Feed, GtfsSpecField } from '../../types'
import type {EditorTables} from '../../types/reducers'

const OPERATORS = {
  eq: '=',
  gte: '>=',
  gt: '>',
  lte: '<=',
  lt: '<',
  neq: '<>',
  like: 'LIKE',
  ilike: 'ILIKE'
  // TODO: Add support for other operators?
  // {"in", "IN"},
  // is: 'IS',
  // cs: '@>',
  // cd: '<@',
  // ov: '&&',
  // sl: '<<',
  // sr: '>>',
  // nxr: '&<',
  // nxl: '&>',
  // adj: '-|-'
}

type State = {
  // TODO: The current structure for defining filters permits only a single
  // filter per field. However, this limits us from applying an update to, for
  // example, stops within a bounding box (max lat and min lat). We may want to
  // make this filter value into an array of strings to enable this feature.
  filter: ?{[string]: string},
  patch: ?{[string]: any},
  show: boolean
}

type Props = {
  activeComponent: string,
  approveGtfsDisabled: boolean,
  createSnapshot: typeof snapshotActions.createSnapshot,
  feedSource: Feed,
  onClose: () => void,
  patchTable: typeof editorActions.patchTable,
  show: boolean,
  tableData: EditorTables
}

export default class BulkEditorModal extends Component<Props, State> {
  state = {
    filter: null,
    patch: null,
    show: false
  }

  handleBulkEdit = () => {
    const { activeComponent, patchTable } = this.props
    const { patch, filter } = this.state
    const invalidFilters = []
    filter && Object.keys(filter).forEach(f => {
      if (!filter[f] || filter[f].startsWith('.')) {
        invalidFilters.push(f)
      }
    })
    if (invalidFilters.length > 0) {
      return window.alert(`CHoisir un opérateur pour les filtres: ${invalidFilters.join(', ')}`)
    }
    patchTable(activeComponent, patch, filter)
  }

  handleClose = () => {
    // Hide modal and set patch object to null
    this.setState({ show: false, patch: null, filter: null })
    this.props.onClose()
  }

  handleRemoveField = (fieldName: string) => {
    const patch = { ...this.state.patch }
    delete patch[fieldName]
    this.setState({ patch })
  }

  handleRemoveFilterField = (fieldName: string) => {
    const filter = { ...this.state.filter }
    delete filter[fieldName]
    this.setState({ filter })
  }

  handleAddField = (evt: SyntheticInputEvent<HTMLInputElement>) => {
    const fieldName = evt.target.value
    if (fieldName) {
      const patch = { ...this.state.patch }
      patch[fieldName] = null
      this.setState({ patch })
    }
  }

  handleAddFilterField = (evt: SyntheticInputEvent<HTMLInputElement>) => {
    const fieldName = evt.target.value
    if (fieldName) {
      const filter = { ...this.state.filter }
      filter[fieldName] = null
      this.setState({ filter })
    }
  }

  handleChangeField = (fieldName: string, value: string) => {
    if (fieldName) {
      const patch = { ...this.state.patch }
      patch[fieldName] = value
      this.setState({ patch })
    }
  }

  handleChangeFilter = (fieldName: string, value: string) => {
    if (fieldName) {
      const filter = { ...this.state.filter }
      filter[fieldName] = value
      this.setState({ filter })
    }
  }

  handleSnapshotClick = () => {
    const name = window.prompt('Entrer un nom pour l\'instantané', formatTimestamp())
    if (name) this.props.createSnapshot(this.props.feedSource, name)
    else if (name === '') window.alert('L\'instantané doit avoir un nom valide.')
  }

  render () {
    const { Body, Footer, Header, Title } = Modal
    const { activeComponent, tableData } = this.props
    const { filter, patch, show } = this.state
    const currentTable = getEditorTable(activeComponent)
    if (!currentTable) throw new Error(`Pas de table trouvée pour ${activeComponent}`)
    const hasEdits = patch && Object.keys(patch).length > 0
    const hasFilters = filter && Object.keys(filter).length > 0
    return (
      <Modal
        show={this.props.show || show}
        onHide={this.handleClose}
      >
        <Header>
          <Title>Bulk Editor pour {currentTable.name}</Title>
        </Header>
        <Body>
          <p>
            Utiliser ce mode pour éditer tous les {activeComponent}s contenus
            dans le flux GTFS. Vous pouvez aussi appliquer un ensemble de
            modifications à un sous-ensemble de {activeComponent}s grâce aux filtres.
          </p>
          <ControlLabel>Ajouter un champ à mettre à jour:</ControlLabel>
          <FormControl
            value=''
            style={{ display: 'inline', width: '200px', marginLeft: '10px' }}
            componentClass='select'
            onChange={this.handleAddField}
          >
            <option value=''>CHoisir un champ à mettre à jour</option>
            {
              currentTable.fields
                .filter(field => field.bulkEditEnabled)
                .map((field, i) => (<option key={field.name}>{field.name}</option>))
            }
          </FormControl>
          {patch
            ? Object.keys(patch).map(key => {
              const field = currentTable.fields.find(f => f.name === key)
              if (!field) throw new Error(`Impossible de trouver le champ pour la clé: ${key}`)
              return (
                <PatchField
                  key={field.name}
                  activeComponent={activeComponent}
                  approveGtfsDisabled={this.props.approveGtfsDisabled}
                  onChange={this.handleChangeField}
                  onRemove={this.handleRemoveField}
                  patch={patch || {}}
                  field={field}
                  tableData={tableData}
                />
              )
            })
            : null
          }
          <hr />
          <ControlLabel>Ajouter un champ à filtrer sur:</ControlLabel>
          <FormControl
            componentClass='select'
            value=''
            style={{ display: 'inline', width: '200px', marginLeft: '10px' }}
            onChange={this.handleAddFilterField}
            onRemove={this.handleRemoveFilterField}
          >
            <option value=''>-- choisir un champ à filtrer sur --</option>
            {
              currentTable.fields
                .map((field, i) => (<option key={field.name}>{field.name}</option>))
            }
          </FormControl>
          <div
            className='text-center lead'
            style={{ margin: '10px' }}>
            Changements appliqués {hasFilters ? 'aux enregistrements où:' : 'à tous les enregistrements.'}
          </div>
          {filter
            ? Object.keys(filter).map(key => {
              const field = currentTable.fields.find(f => f.name === key)
              if (!field) throw new Error(`Impossible de trouver le champ pour la clé: ${key}`)
              return (
                <FilterField
                  key={field.name}
                  onChange={this.handleChangeFilter}
                  onRemove={this.handleRemoveFilterField}
                  filter={filter || {}}
                  field={field}
                />
              )
            })
            : null
          }
          <Alert bsStyle='warning' style={{ marginTop: '20px' }}>
            <strong>Attention:</strong> Bulk editor modifiera tous les enregistrements
           (ou ceux sélectionnés selon le filtre), mais cette opération est irréversible.
            <hr />
            Il est recommandé de créer dans un premier temps un instantané de la
            donnée dans l'éditeur avant d'appliquer un bulk edit. Un instantané
            permet de revenir sur vos changements si le bulk editor est mal appliqué.
            <Button
              onClick={this.handleSnapshotClick}
              style={{ marginTop: '10px' }}
              block>
              <Icon type='camera' /> Prendre un instantané
            </Button>
          </Alert>
        </Body>
        <Footer>
          <Button
            bsStyle='primary'
            disabled={!hasEdits}
            onClick={this.handleBulkEdit}
          >
            Appliquer le Bulk edit
          </Button>
          <Button
            onClick={this.handleClose}
          >
            Fermer
          </Button>
        </Footer>
      </Modal>
    )
  }
}

type PatchFieldProps = {
  activeComponent: string,
  approveGtfsDisabled: boolean,
  field: GtfsSpecField,
  onChange: (string, any) => void,
  onRemove: string => void,
  patch: {[string]: any},
  tableData: EditorTables
}

class PatchField extends Component<PatchFieldProps> {
  handleChangeValue = (val: any) => {
    this.props.onChange(this.props.field.name, val)
  }

  handleRemove = () => this.props.onRemove(this.props.field.name)

  render () {
    const {
      activeComponent,
      approveGtfsDisabled,
      field,
      patch,
      tableData
    } = this.props
    const value = patch[field.name]
    const table = getTableById(tableData, activeComponent)
    const entity = ((patch: any): Entity)
    const isNotValid = !!(validate(field, value, table, entity, tableData))
    const {zoneOptions} = getZones(getTableById(tableData, 'stop'))
    return (
      <div className='col-xs-12'>
        <EditorInput
          activeComponent={activeComponent}
          field={{ ...field, columnWidth: 6 }} // override column width
          tableData={tableData}
          currentValue={value}
          onChange={this.handleChangeValue}
          approveGtfsDisabled={approveGtfsDisabled}
          isNotValid={isNotValid}
          zoneOptions={zoneOptions}
        />
        <br />
        <Button
          bsStyle='link'
          bsSize='small'
          style={{padding: '0 2px 10px 2px', marginTop: '10px'}}
          title='Supprimer le tracé du motif'
          onClick={this.handleRemove}>
          <span className='text-danger'><Icon type='trash' /></span>
        </Button>
      </div>
    )
  }
}

type FilterFieldProps = {
  field: GtfsSpecField,
  filter: {[string]: any},
  onChange: (string, string) => void,
  onRemove: string => void
}

class FilterField extends Component<FilterFieldProps> {
  handleRemove = () => this.props.onRemove(this.props.field.name)

  handleChangeOperator = (evt: SyntheticInputEvent<HTMLInputElement>) => {
    const newOperator = evt.target.value
    const [, value] = this._getParts()
    this.props.onChange(this.props.field.name, `${newOperator}.${value}`)
  }

  handleChangeValue = (evt: SyntheticInputEvent<HTMLInputElement>) => {
    const newValue = evt.target.value
    const [operator] = this._getParts()
    this.props.onChange(this.props.field.name, `${operator}.${newValue}`)
  }

  _getParts = () => {
    const query = this.props.filter[this.props.field.name]
    if (query) {
      // Note: we can't use String#split here because even with a limit arg it
      // still can't quite handle decimal places correctly.
      const separatorIndex = query.indexOf('.')
      return [query.substr(0, separatorIndex), query.substr(separatorIndex + 1)]
    } else {
      return ['', '']
    }
  }

  render () {
    const { field } = this.props
    const [operator, value] = this._getParts()
    const addMargin = { marginRight: '10px' }
    return (
      <div>
        <span style={addMargin}>{field.name}</span>
        <FormControl
          style={{
            ...addMargin,
            display: 'inline',
            width: '100px',
            textAlignLast: 'center'
          }}
          value={operator || ''}
          onChange={this.handleChangeOperator}
          componentClass='select'
        >
          <option disabled value=''>choisir un opérateur</option>
          {Object.keys(OPERATORS).map(key => (
            <option value={key} key={key}>{OPERATORS[key]}</option>
          ))}
        </FormControl>
        <FormControl
          style={{ ...addMargin, display: 'inline', width: '100px' }}
          onChange={this.handleChangeValue}
          value={value}
        />
        <Button
          bsStyle='link'
          bsSize='small'
          style={{padding: '0 2px 10px 2px'}}
          title='Supprimer le tracé du motif'
          onClick={this.handleRemove}>
          <span className='text-danger'><Icon type='trash' /></span>
        </Button>
      </div>
    )
  }
}
